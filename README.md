# 软渲染器代码流程说明

本文档按**代码执行顺序**说明：文件各自干什么、函数谁调谁、一帧里数据怎么从顶点走到像素。

---

## 1. 文件与依赖关系

```
index.html
    └── 加载 src/main.ts

main.ts
    ├── Geometry.ts  →  Camera, Mesh
    └── Device.ts      →  Device（内部用 @babylonjs/core 的 Vector / Matrix / Color4）

Geometry.ts
    └── 仅定义数据结构，不负责绘制
```

| 文件 | 职责 |
|------|------|
| `index.html` | 提供 `<canvas id="frontBuffer">`，入口脚本指向 `main.ts` |
| `main.ts` | 初始化场景、启动 `requestAnimationFrame` 循环 |
| `Geometry.ts` | `Camera`、`Mesh` 数据类 |
| `Device.ts` | 后缓冲、投影、遍历网格、写像素 |

---

## 2. 程序从打开页面到第一帧

### 2.1 浏览器加载 `index.html`

```html
<canvas id="frontBuffer" width="640" height="480" ...></canvas>
<script type="module" src="/src/main.ts"></script>
```

- 画布逻辑尺寸：**640×480**（`Device` 里 `workingWidth` / `workingHeight` 来自这里）。
- `type="module"`：按 ES Module 执行 `main.ts`，解析完成后运行模块顶层代码。

### 2.2 `main.ts` 模块顶层

```ts
// 全局状态（整个程序共用）
let canvas: HTMLCanvasElement;
let device: Device;
let camera: Camera;
const meshes: Mesh[] = [];

init();  // 模块加载完立即调用，不等待 DOMContentLoaded
```

脚本在 `</body>` 前，执行 `init()` 时 DOM 里已有 `frontBuffer`。

---

## 3. `init()`：搭好场景，进入循环

对应 `main.ts` 第 10～30 行。

```
init()
  ├─ 1. 取 canvas
  ├─ 2. new Device(canvas)
  ├─ 3. new Camera() 并设置 Position / Target
  ├─ 4. 创建立方体 Mesh，填 8 个顶点
  ├─ 5. meshes.push(mesh)
  └─ 6. requestAnimationFrame(drawingLoop)  // 预约第一帧
```

### 3.1 绑定画布与设备

```ts
const el = document.getElementById("frontBuffer");
canvas = el;                    // 必须是 HTMLCanvasElement
device = new Device(canvas);    // 见 §5：保存宽高、拿 2D 上下文
```

### 3.2 相机

```ts
camera = new Camera();
camera.Position = new Vector3(0, 0, 10);   // 相机在 Z=10
camera.Target   = new Vector3(0, 0, 0);    // 看向原点
```

`Camera` 类本身只有两个字段（`Geometry.ts`），没有 `render` 逻辑；真正用相机矩阵的是 `Device.render()` 里的 `Matrix.LookAtLH(camera.Position, camera.Target, ...)`。

### 3.3 立方体网格

```ts
const mesh = new Mesh("Cube", 8);
```

`Mesh` 构造函数会：

- 分配长度为 8 的 `Vertices` 数组；
- `Rotation`、`Position` 初始为 `(0,0,0)`。

然后**手动**写入 8 个局部坐标（边长 2，中心在原点）：

| 索引 | 坐标 | 含义（局部空间） |
|------|------|------------------|
| 0 | (-1,  1,  1) | 前左上 |
| 1 | ( 1,  1,  1) | 前右上 |
| 2 | (-1, -1,  1) | 前左下 |
| 3 | (-1, -1, -1) | 后左下 |
| 4 | (-1,  1, -1) | 后左上 |
| 5 | ( 1,  1, -1) | 后右上 |
| 6 | ( 1, -1,  1) | 前右下 |
| 7 | ( 1, -1, -1) | 后右下 |

```ts
meshes.push(mesh);
requestAnimationFrame(drawingLoop);
```

此时还**没有**画任何东西；第一帧由浏览器在下一帧回调 `drawingLoop`。

---

## 4. `drawingLoop()`：每一帧的固定四步

对应 `main.ts` 第 35～44 行，之后每帧递归调用自己。

```
drawingLoop()
  │
  ├─ device.clear()           // 清空并拿到后缓冲
  │
  ├─ currentMesh.Rotation     // 每帧 +0.01，产生旋转动画
  │     .x += 0.01
  │     .y += 0.01
  │
  ├─ device.render(camera, meshes)   // 所有 MVP + 画点
  │
  ├─ device.present()         // 后缓冲贴到 canvas
  │
  └─ requestAnimationFrame(drawingLoop)   // 下一帧
```

**要点**：旋转改的是 `Mesh.Rotation`，在 `render` 里会进入 `Matrix.RotationYawPitchRoll`，所以点每帧位置会变。

---

## 5. `Device` 类：成员与构造

```ts
private workingCanvas: HTMLCanvasElement;
private workingContext: CanvasRenderingContext2D;
private workingWidth: number;   // 640
private workingHeight: number;  // 480

private backbuffer!: ImageData;           // 一整块 RGBA 像素
private backbufferdata!: Uint8ClampedArray;  // backbuffer.data，直接改字节
```

```ts
constructor(canvas: HTMLCanvasElement) {
    this.workingCanvas = canvas;
    this.workingWidth = canvas.width;
    this.workingHeight = canvas.height;
    this.workingContext = this.workingCanvas.getContext("2d")!;
}
```

构造阶段**不**分配后缓冲；第一次 `clear()` 时通过 `getImageData` 创建。

---

## 6. `clear()` 与 `present()`：后缓冲机制

### 6.1 `clear()`

```ts
this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
this.backbuffer = this.workingContext.getImageData(0, 0, this.workingWidth, this.workingHeight);
this.backbufferdata = this.backbuffer.data;
```

流程：

1. `clearRect`：把 Canvas 2D 显示层清掉（透明）。
2. `getImageData`：把当前画布内容读成 `ImageData`（宽×高×4 字节）。
3. `backbufferdata` 指向同一块内存，后面 `putPixel` 只改数组，不立刻显示。

### 6.2 `present()`

```ts
this.workingContext.putImageData(this.backbuffer, 0, 0);
```

把本帧改过的 `backbuffer` 一次性写回 Canvas，用户才看到画面。

```
一帧内：  clear → 在 backbufferdata 上画 → present
```

---

## 7. `render(camera, meshes)`：核心流水线

对应 `Device.ts` 第 48～73 行。

### 7.1 总览

```
render()
  │
  ├─ ViewMatrix      = LookAtLH(相机位置, 目标点, 世界上方)
  ├─ projectionMatrix = PerspectiveFovLH(fov, 宽高比, near, far)
  │
  └─ for each cMesh in meshes
        │
        ├─ worldMatrix = RotationYawPitchRoll(rotY, rotX, rotZ)
        │                  .multiply(Translation(pos))
        │
        ├─ transformMatrix = world × view × projection
        │
        └─ for each vertex in cMesh.Vertices
              if (vertex 存在)
                projectedPoint = project(vertex, transformMatrix)
                drawPoint(projectedPoint)
```

### 7.2 View 矩阵（观察）

```ts
const ViewMatrix = Matrix.LookAtLH(
    camera.Position,
    camera.Target,
    Vector3.Up()
);
```

把世界坐标变换到**以相机为原点、看向 Target** 的空间。当前相机在 `(0,0,10)` 看 `(0,0,0)`。

### 7.3 Projection 矩阵（透视）

```ts
const projectionMatrix = Matrix.PerspectiveFovLH(
    0.78,                              // 垂直 FOV（弧度）
    this.workingWidth / this.workingHeight,  // 640/480
    0.01,                              // 近裁剪面
    100.0                              // 远裁剪面
);
```

把视空间压到裁剪空间（透视除法前）。`far = 100` 才能包住距离约 10 的立方体；`far = 1` 时容易裁掉。

### 7.4 World 矩阵（物体）

```ts
const worldMatrix = Matrix.RotationYawPitchRoll(
    cMesh.Rotation.y,   // yaw
    cMesh.Rotation.x,   // pitch
    cMesh.Rotation.z    // roll
).multiply(Matrix.Translation(
    cMesh.Position.x,
    cMesh.Position.y,
    cMesh.Position.z
));
```

- 先绕物体自身旋转（每帧 `main` 里改 `Rotation`）。
- 再平移到 `Position`（默认 0，立方体绕原点转）。

### 7.5 合并矩阵

```ts
const transformMatrix = worldMatrix
    .multiply(ViewMatrix)
    .multiply(projectionMatrix);
```

对一个**局部顶点** `v`，等价于：

```
v' = v × World × View × Projection
```

（Babylon 行向量在左的约定，与 `Vector3.TransformCoordinates` 一致。）

### 7.6 遍历顶点

```ts
for (const vertex of cMesh.Vertices) {
    if (vertex) {
        const projectedPoint = this.project(vertex, transformMatrix);
        this.drawPoint(projectedPoint);
    }
}
```

当前立方体：8 次循环，8 次 `drawPoint`（每个顶点一个黄点）。没有索引、没有三角形。

---

## 8. `project()`：3D → 屏幕像素坐标

```ts
public project(coord: Vector3, transMat: Matrix): Vector2 {
    const point = Vector3.TransformCoordinates(coord, transMat);
    const x = (point.x * this.workingWidth + this.workingWidth / 2.0) >> 0;
    const y = (-point.y * this.workingHeight + this.workingHeight / 2.0) >> 0;
    return new Vector2(x, y);
}
```

分两步：

| 步骤 | 代码 | 含义 |
|------|------|------|
| ① 矩阵变换 + 透视除法 | `TransformCoordinates` | 输出约在 NDC：x、y ∈ [-1, 1]（在视锥内时） |
| ② 映射到像素 | `x = point.x * width/2 + width/2` | [-1,1] → [0, width] |
| ② Y 翻转 | `y = -point.y * height/2 + height/2` | 数学 Y 向上 → 屏幕 Y 向下 |

`>> 0`：截断为整数像素坐标。

---

## 9. `drawPoint()` 与 `putPixel()`：真正写颜色

### 9.1 `drawPoint`

```ts
if (point.x >= 0 && point.y >= 0
    && point.x < this.workingWidth && point.y < this.workingHeight) {
    this.putPixel(point.x, point.y, new Color4(1, 1, 0, 1));  // 黄色
}
```

屏幕外则丢弃，避免 `putPixel` 越界。

### 9.2 `putPixel`

```ts
const intX = x >> 0;
const intY = y >> 0;
const index = (intX + intY * this.workingWidth) * 4;

this.backbufferdata[index]     = color.r * 255;  // R
this.backbufferdata[index + 1] = color.g * 255;  // G
this.backbufferdata[index + 2] = color.b * 255;  // B
this.backbufferdata[index + 3] = color.a * 255;  // A
```

- 一行 `width` 个像素，每个像素 4 字节（RGBA）。
- `Color4(1,1,0,1)` 表示满黄、不透明。

**当前限制**：每个顶点只写 **1 个像素**，所以看到的是 8 个黄点，不是实心立方体。

---

## 10. 单帧完整调用链（串联）

以第 N 帧为例，`meshes` 里只有立方体：

```
requestAnimationFrame 回调 drawingLoop
│
├─ Device.clear()
│     clearRect(640×480)
│     backbuffer ← getImageData()
│
├─ meshes[0].Rotation.x += 0.01
├─ meshes[0].Rotation.y += 0.01
│
├─ Device.render(camera, meshes)
│     View ← LookAtLH((0,0,10), (0,0,0), Up)
│     Proj ← PerspectiveFovLH(0.78, 640/480, 0.01, 100)
│     │
│     └─ Mesh "Cube"
│           World ← RotationYawPitchRoll(rotY, rotX, rotZ) × Translation(0,0,0)
│           T ← World × View × Proj
│           │
│           ├─ vertex[0] (-1,1,1)  → project → drawPoint → putPixel
│           ├─ vertex[1] (1,1,1)   → ...
│           ├─ ... 共 8 个顶点
│           └─ vertex[7] (1,-1,-1) → ...
│
├─ Device.present()
│     putImageData(backbuffer) → 屏幕显示
│
└─ requestAnimationFrame(drawingLoop)  // 第 N+1 帧
```

---

## 11. `Geometry.ts` 数据结构（无绘制逻辑）

### `Camera`

```ts
public Position: Vector3;
public Target: Vector3;
```

仅存储；矩阵在 `Device.render` 里计算。

### `Mesh`

```ts
public name: string;
public Rotation: Vector3;   // 每帧在 main 里修改
public Position: Vector3;   // 默认 Zero，整体平移
public Vertices: Vector3[]; // 局部空间顶点列表
```

没有 `Indices`、没有 `Faces`；因此代码**不可能**自动画面，只能画点。

---

## 12. 你现在在屏幕上看到的是什么

- **8 个黄色像素点**：立方体 8 个角，经 MVP 投影后的位置。
- **会旋转**：因为 `drawingLoop` 每帧增加 `Rotation.x / Rotation.y`，`worldMatrix` 每帧不同。
- **不是线框/实体**：`render` 里没有边列表、没有三角形填充。

---

## 13. 代码扩展时通常改哪里

| 想实现的功能 | 主要改动位置 |
|--------------|--------------|
| 线框立方体 | `Mesh` 增加边索引；`Device` 增加 `drawLine`，`render` 里连顶点对 |
| 实心三角面 | `Mesh` 增加面/索引；`Device` 增加三角形光栅化 |
| 深度正确遮挡 | `Device` 增加 Z-Buffer 数组，`putPixel` 前比较深度 |
| 多物体 | `main` 里 `meshes.push` 多个 `Mesh`，`render` 已支持数组 |
| 相机控制 | 改 `camera.Position` / `Target`，或加输入改 `Rotation` |

`main.ts` 的 **clear → 更新 → render → present** 循环可以长期保持不变；新能力尽量加在 `Device` 和 `Mesh` 结构上。

---

## 14. 阅读代码的推荐顺序

1. `index.html`：canvas 从哪来。  
2. `Geometry.ts`：有哪些数据。  
3. `main.ts`：`init` + `drawingLoop` 整体节奏。  
4. `Device.render`：矩阵怎么乘、顶点怎么遍历。  
5. `Device.project` / `putPixel`：一个点如何变成屏幕上的一个像素。  
6. 对照运行画面：旋转时 8 个点应绕画面中心附近转动。

按这个顺序读，可以把「软渲染」落实为**可跟进的函数调用链**，而不是抽象概念。
