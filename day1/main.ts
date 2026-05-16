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
