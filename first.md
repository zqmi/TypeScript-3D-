# soft-renderer 核心代码说明（`src/`）

本文档对应目录：`TypeScript_3DRender/soft-renderer/src`  
说明三个核心文件里的**完整代码**及**执行流程**。

```
src/
├── Geometry.ts   场景数据：相机、网格
├── Device.ts     软渲染：后缓冲、矩阵、画像素
└── main.ts       入口：初始化 + 每帧循环
```

---

## 一、整体流程（先看这个）

```
main.ts: init()
    → 创建 Device、Camera、立方体 Mesh
    → requestAnimationFrame(drawingLoop)

main.ts: drawingLoop()  【每帧重复】
    → device.clear()        清空，拿到后缓冲
    → 修改 mesh.Rotation    旋转动画
    → device.render()       MVP 变换，画 8 个顶点
    → device.present()      后缓冲显示到 Canvas
    → requestAnimationFrame(drawingLoop)
```

---

## 二、`Geometry.ts` — 场景里有什么

只定义数据结构，**不负责绘制**。

### 完整代码

```typescript
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

export class Camera {
    public Position: Vector3;
    public Target: Vector3;
    constructor(
        position: Vector3 = Vector3.Zero(),
        target: Vector3 = Vector3.Zero()
    ) {
        this.Position = position;
        this.Target = target;
    }
}

export class Mesh{
    public name: string;
    public Rotation: Vector3;
    public Position: Vector3;
    public Vertices: Vector3[];
    constructor(name: string, verticesCount: number){
        this.name = name;
        this.Vertices = new Array<Vector3>(verticesCount);
        this.Rotation = Vector3.Zero();
        this.Position = Vector3.Zero();
    }
}
```

### 说明

| 类 | 字段 | 作用 |
|----|------|------|
| `Camera` | `Position` | 相机在世界空间的位置 |
| `Camera` | `Target` | 相机看向的点 |
| `Mesh` | `name` | 网格名称 |
| `Mesh` | `Vertices` | 局部坐标下的顶点数组 |
| `Mesh` | `Position` | 物体平移（默认 0） |
| `Mesh` | `Rotation` | 物体旋转，每帧在 `main.ts` 里修改 |

`Device.render()` 会读取 `Camera` 和 `Mesh`，在这里不算矩阵。

---

## 三、`main.ts` — 程序入口与帧循环

### 完整代码

```typescript
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Camera, Mesh } from "./Geometry";
import { Device } from "./Device";

let canvas: HTMLCanvasElement;
let device: Device;
let camera: Camera;
const meshes: Mesh[] = [];

function init(): void {
    const el = document.getElementById("frontBuffer");
    if (!(el instanceof HTMLCanvasElement)) {
        throw new Error('Missing <canvas id="frontBuffer"> in index.html');
    }
    canvas = el;
    device = new Device(canvas);
    camera = new Camera();
    camera.Position = new Vector3(0, 0, 10);
    camera.Target = new Vector3(0, 0, 0);
    const mesh = new Mesh("Cube", 8);
    mesh.Vertices[0] = new Vector3(-1, 1, 1);
    mesh.Vertices[1] = new Vector3(1, 1, 1);
    mesh.Vertices[2] = new Vector3(-1, -1, 1);
    mesh.Vertices[3] = new Vector3(-1, -1, -1);
    mesh.Vertices[4] = new Vector3(-1, 1, -1);
    mesh.Vertices[5] = new Vector3(1, 1, -1);
    mesh.Vertices[6] = new Vector3(1, -1, 1);
    mesh.Vertices[7] = new Vector3(1, -1, -1);
    meshes.push(mesh);
    requestAnimationFrame(drawingLoop);
}

init();

function drawingLoop(): void {
    device.clear();
    const currentMesh = meshes[0];
    if (currentMesh) {
        currentMesh.Rotation.x += 0.01;
        currentMesh.Rotation.y += 0.01;
    }
    device.render(camera, meshes);
    device.present();
    requestAnimationFrame(drawingLoop);
}
```

### `init()` 逐步说明

1. **`getElementById("frontBuffer")`**  
   与 `index.html` 里 `<canvas id="frontBuffer">` 对应；找不到则抛错。

2. **`new Device(canvas)`**  
   绑定 640×480（或 HTML 里写的宽高），准备 2D 上下文与后缓冲。

3. **相机**  
   - `Position = (0, 0, 10)`：在 Z 轴正方向 10 处  
   - `Target = (0, 0, 0)`：看向原点  

4. **立方体 8 个顶点**（局部空间，边长 2，中心在原点）

   | 下标 | 坐标 | 角 |
   |------|------|-----|
   | 0 | (-1,  1,  1) | 前左上 |
   | 1 | ( 1,  1,  1) | 前右上 |
   | 2 | (-1, -1,  1) | 前左下 |
   | 3 | (-1, -1, -1) | 后左下 |
   | 4 | (-1,  1, -1) | 后左上 |
   | 5 | ( 1,  1, -1) | 后右上 |
   | 6 | ( 1, -1,  1) | 前右下 |
   | 7 | ( 1, -1, -1) | 后右下 |

5. **`meshes.push(mesh)`**  
   场景列表里只有这一个物体。

6. **`requestAnimationFrame(drawingLoop)`**  
   下一帧开始循环。

### `drawingLoop()` 每帧四步

```typescript
device.clear();                    // ① 清空后缓冲
currentMesh.Rotation.x += 0.01;    // ② 更新旋转
currentMesh.Rotation.y += 0.01;
device.render(camera, meshes);     // ③ 投影并画点
device.present();                  // ④ 显示到屏幕
requestAnimationFrame(drawingLoop);
```

旋转写在 `main` 里，矩阵在 `Device.render` 里用 `RotationYawPitchRoll` 读这些值。

---

## 四、`Device.ts` — 软渲染核心

### 完整代码

```typescript
import { Matrix, Vector3, Vector2 } from "@babylonjs/core/Maths/math.vector.js";
import { Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Camera, Mesh } from './Geometry';

export class Device {
    private workingCanvas: HTMLCanvasElement;
    private workingContext: CanvasRenderingContext2D;
    private workingWidth: number;
    private workingHeight: number;

    private backbuffer!: ImageData;
    private backbufferdata!: Uint8ClampedArray;

    constructor(canvas: HTMLCanvasElement){
        this.workingCanvas = canvas;
        this.workingWidth = canvas.width;
        this.workingHeight = canvas.height;
        this.workingContext = this.workingCanvas.getContext("2d")!;
    }
    public clear(): void {
        this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
        this.backbuffer = this.workingContext.getImageData(0, 0, this.workingWidth, this.workingHeight);
        this.backbufferdata = this.backbuffer.data;
    }
    public present(): void {
        this.workingContext.putImageData(this.backbuffer,0 ,0);
    }
    public putPixel(x: number, y: number, color: Color4): void {
        const intX = x >> 0;
        const intY = y >> 0;
        const index = (intX + intY * this.workingWidth) * 4;
        this.backbufferdata[index]     = color.r * 255;
        this.backbufferdata[index+1]   = color.g * 255;
        this.backbufferdata[index+2]   = color.b * 255;
        this.backbufferdata[index+3]   = color.a * 255;
    }
    public project(coord: Vector3, transMat: Matrix): Vector2 {
        const point = Vector3.TransformCoordinates(coord, transMat);
        const x = (point.x * this.workingWidth + this.workingWidth / 2.0) >> 0;
        const y = (-point.y * this.workingHeight + this.workingHeight / 2.0) >> 0;
        return new Vector2(x,y);
    }
    public drawPoint(point: Vector2): void {
        if(point.x >= 0 && point.y >=0 && point.x < this.workingWidth && point.y < this.workingHeight){
            this.putPixel(point.x, point.y, new Color4(1,1,0,1));
        }
    }
    public render(camera: Camera, meshes: Mesh[]): void {
        const ViewMatrix = Matrix.LookAtLH(camera.Position, camera.Target, Vector3.Up());
        const projectionMatrix = Matrix.PerspectiveFovLH(
            0.78,
            this.workingWidth/this.workingHeight,
            0.01,
            100.0
        );
        for (const cMesh of meshes){
            const worldMatrix = Matrix.RotationYawPitchRoll(
                cMesh.Rotation.y,
                cMesh.Rotation.x,
                cMesh.Rotation.z
            ).multiply(Matrix.Translation(
                cMesh.Position.x,
                cMesh.Position.y,
                cMesh.Position.z
            ));
            const transformMatrix = worldMatrix.multiply(ViewMatrix).multiply(projectionMatrix);
            for(const vertex of cMesh.Vertices){
                if(vertex){
                    const projectedPoint = this.project(vertex, transformMatrix);
                    this.drawPoint(projectedPoint);
                }
            }
        }
    }
}
```

---

### 4.1 成员变量

```typescript
private workingCanvas: HTMLCanvasElement;
private workingContext: CanvasRenderingContext2D;
private workingWidth: number;    // canvas.width
private workingHeight: number;   // canvas.height

private backbuffer!: ImageData;
private backbufferdata!: Uint8ClampedArray;  // 指向 RGBA 字节数组
```

- 画像素时只改 `backbufferdata`，不直接动屏幕。  
- `present()` 时再一次性贴到 Canvas。

---

### 4.2 `constructor` — 绑定画布

```typescript
constructor(canvas: HTMLCanvasElement){
    this.workingCanvas = canvas;
    this.workingWidth = canvas.width;
    this.workingHeight = canvas.height;
    this.workingContext = this.workingCanvas.getContext("2d")!;
}
```

记录宽高；后续投影、边界判断都依赖这两个数。

---

### 4.3 `clear()` — 准备本帧的后缓冲

```typescript
public clear(): void {
    this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
    this.backbuffer = this.workingContext.getImageData(0, 0, this.workingWidth, this.workingHeight);
    this.backbufferdata = this.backbuffer.data;
}
```

1. `clearRect`：清 Canvas 显示层。  
2. `getImageData`：读出 `width × height × 4` 字节的 RGBA。  
3. `backbufferdata` 供 `putPixel` 写入。

---

### 4.4 `present()` — 显示到屏幕

```typescript
public present(): void {
    this.workingContext.putImageData(this.backbuffer, 0, 0);
}
```

本帧所有 `putPixel` 完成后调用，用户才看到画面。

---

### 4.5 `putPixel()` — 写一个像素

```typescript
public putPixel(x: number, y: number, color: Color4): void {
    const intX = x >> 0;
    const intY = y >> 0;
    const index = (intX + intY * this.workingWidth) * 4;
    this.backbufferdata[index]     = color.r * 255;
    this.backbufferdata[index+1]   = color.g * 255;
    this.backbufferdata[index+2]   = color.b * 255;
    this.backbufferdata[index+3]   = color.a * 255;
}
```

- 一行 `workingWidth` 个像素，每像素 4 字节：R、G、B、A。  
- `index = (x + y * width) * 4` 是软渲染里最底层的操作。  
- `Color4` 分量是 0～1，乘 255 写入字节。

---

### 4.6 `project()` — 3D 点 → 屏幕坐标

```typescript
public project(coord: Vector3, transMat: Matrix): Vector2 {
    const point = Vector3.TransformCoordinates(coord, transMat);
    const x = (point.x * this.workingWidth + this.workingWidth / 2.0) >> 0;
    const y = (-point.y * this.workingHeight + this.workingHeight / 2.0) >> 0;
    return new Vector2(x, y);
}
```

| 步骤 | 代码 | 含义 |
|------|------|------|
| 1 | `TransformCoordinates` | 顶点 × 矩阵，并做透视除法，得到 NDC 附近坐标 |
| 2 | `point.x * width/2 + width/2` | x 从 [-1,1] 映射到 [0, width] |
| 3 | `-point.y * ...` | 翻转 Y：数学坐标 Y 向上，屏幕 Y 向下 |
| 4 | `>> 0` | 取整像素坐标 |

---

### 4.7 `drawPoint()` — 在屏幕内画黄点

```typescript
public drawPoint(point: Vector2): void {
    if(point.x >= 0 && point.y >=0 && point.x < this.workingWidth && point.y < this.workingHeight){
        this.putPixel(point.x, point.y, new Color4(1,1,0,1));
    }
}
```

- 越界不画，防止 `putPixel` 写坏数组。  
- `Color4(1,1,0,1)` = 黄色不透明。  
- **每个顶点只画 1 个像素**，所以是 8 个点而不是实心立方体。

---

### 4.8 `render()` — MVP 与遍历顶点

```typescript
public render(camera: Camera, meshes: Mesh[]): void {
    const ViewMatrix = Matrix.LookAtLH(camera.Position, camera.Target, Vector3.Up());
    const projectionMatrix = Matrix.PerspectiveFovLH(
        0.78,
        this.workingWidth/this.workingHeight,
        0.01,
        100.0
    );
    for (const cMesh of meshes){
        const worldMatrix = Matrix.RotationYawPitchRoll(
            cMesh.Rotation.y,
            cMesh.Rotation.x,
            cMesh.Rotation.z
        ).multiply(Matrix.Translation(
            cMesh.Position.x,
            cMesh.Position.y,
            cMesh.Position.z
        ));
        const transformMatrix = worldMatrix.multiply(ViewMatrix).multiply(projectionMatrix);
        for(const vertex of cMesh.Vertices){
            if(vertex){
                const projectedPoint = this.project(vertex, transformMatrix);
                this.drawPoint(projectedPoint);
            }
        }
    }
}
```

**矩阵含义：**

```
ViewMatrix       = LookAtLH(相机位置, 目标点, 世界上方)
projectionMatrix = PerspectiveFovLH(fov, 宽高比, near, far)
worldMatrix      = RotationYawPitchRoll(y,x,z) × Translation(x,y,z)
transformMatrix  = world × view × projection
```

**对每个顶点：**

```
屏幕点 = project(顶点局部坐标, transformMatrix)
       → drawPoint(屏幕点)
       → putPixel(写入后缓冲)
```

当前立方体：8 个顶点 → 8 次 `drawPoint` → 8 个黄点。

---

## 五、单帧调用链（串联三份代码）

```
drawingLoop (main.ts)
│
├─ Device.clear()
│     clearRect → getImageData → backbufferdata
│
├─ meshes[0].Rotation += 0.01  (main.ts)
│
├─ Device.render(camera, meshes)
│     │
│     ├─ ViewMatrix = LookAtLH(camera.Position, camera.Target, Up)
│     ├─ Proj = PerspectiveFovLH(0.78, 640/480, 0.01, 100)
│     │
│     └─ for Mesh in meshes
│           World = Rotation(Rotation.y,x,z) × Translation(Position)
│           T = World × View × Proj
│           for vertex in Vertices
│                 project(vertex, T) → drawPoint → putPixel
│
└─ Device.present()
      putImageData → Canvas 显示
```

---

## 六、当前效果与代码的对应关系

| 现象 | 对应代码 |
|------|----------|
| 8 个黄点在转 | `main` 改 `Rotation` + `render` 里 8 次 `drawPoint` |
| 不是实心立方体 | 没有边索引、没有三角形填充 |
| 相机从斜前方看原点 | `camera.Position(0,0,10)` + `Target(0,0,0)` |
| 黑底 | `index.html` 里 canvas `background: black` |

---

## 七、后续扩展时改哪里

| 目标 | 改动的文件 / 函数 |
|------|-------------------|
| 线框 | `Mesh` 加边表；`Device` 加 `drawLine`；`render` 里连线 |
| 三角面填充 | `Mesh` 加索引；`Device` 加光栅化 |
| 深度遮挡 | `Device` 加 Z 缓冲，在 `putPixel` 前比较 z |
| 更多物体 | `main.ts` 里多次 `meshes.push` |

`main.ts` 的 **clear → 更新 → render → present** 循环可以保持不变。
