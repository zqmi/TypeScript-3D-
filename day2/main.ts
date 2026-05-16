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
    const mesh = new Mesh("Cube", 8, 12);
    mesh.Vertices[0] = new Vector3(-1, 1, 1);
    mesh.Vertices[1] = new Vector3(1, 1, 1);
    mesh.Vertices[2] = new Vector3(-1, -1, 1);
    mesh.Vertices[3] = new Vector3(-1, -1, -1);
    mesh.Vertices[4] = new Vector3(-1, 1, -1);
    mesh.Vertices[5] = new Vector3(1, 1, -1);
    mesh.Vertices[6] = new Vector3(1, -1, 1);
    mesh.Vertices[7] = new Vector3(1, -1, -1);


// 前 (z=+1)
    mesh.Faces[0]  = { A: 0, B: 1, C: 6 };
    mesh.Faces[1]  = { A: 0, B: 6, C: 2 };
    // 后 (z=-1)
    mesh.Faces[2]  = { A: 4, B: 7, C: 5 };
    mesh.Faces[3]  = { A: 4, B: 3, C: 7 };
    // 上 (y=+1)
    mesh.Faces[4]  = { A: 0, B: 5, C: 1 };
    mesh.Faces[5]  = { A: 0, B: 4, C: 5 };
    // 下 (y=-1)
    mesh.Faces[6]  = { A: 2, B: 7, C: 6 };
    mesh.Faces[7]  = { A: 2, B: 3, C: 7 };
    // 左 (x=-1)
    mesh.Faces[8]  = { A: 0, B: 3, C: 2 };
    mesh.Faces[9]  = { A: 0, B: 4, C: 3 };
    // 右 (x=+1)
    mesh.Faces[10] = { A: 1, B: 6, C: 5 };
    mesh.Faces[11] = { A: 5, B: 6, C: 7 };
 
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
