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
    public drawLine(point0: Vector2, point1: Vector2) : void{
        const dist = point1.subtract(point0).length();
        if(dist<2){
            return ;
        }
        const middlePoint = point0.add(point1.subtract(point0).scale(0.5));
        this.drawPoint(middlePoint);
        this.drawLine(point0,middlePoint);
        this.drawLine(middlePoint,point1);
    }
    public drawBLine(point0: Vector2, point1: Vector2) : void {
        var x0 = point0.x >> 0;
        var y0 = point0.y >> 0;
        const x1 = point1.x >> 0;
        const y1 = point1.y >> 0;
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        var err = dx - dy;
        while (true) {
            this.drawPoint(new Vector2(x0, y0));
            if ((x0 == x1) && (y0 == y1)) break;
            var e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
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
            for(var indexFaces = 0;indexFaces < cMesh.Faces.length;indexFaces++){
                // const point0 = this.project (cMesh.Vertices[i], transformMatrix);
                // const point1 = this.project (cMesh.Vertices[i+1], transformMatrix);
                // this.drawLine (point0, point1); 
                const currentFace = cMesh.Faces[indexFaces];
                const vertexA = cMesh.Vertices[currentFace.A];
                const vertexB = cMesh.Vertices[currentFace.B];
                const vertexC = cMesh.Vertices[currentFace.C];
                const pixelA = this.project(vertexA, transformMatrix);
                const pixelB = this.project(vertexB, transformMatrix);
                const pixelC = this.project(vertexC, transformMatrix);
                this.drawBLine(pixelA, pixelB);
                this.drawBLine(pixelB, pixelC);
                this.drawBLine(pixelC, pixelA);
            }
            // for(const vertex of cMesh.Vertices){
            //     if(vertex){
            //         const projectedPoint = this.project(vertex, transformMatrix);
            //         this.drawPoint(projectedPoint);
            //     }
            // }
        }
    }
}
