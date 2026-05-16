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
    private depthbuffer: number [];

    constructor(canvas: HTMLCanvasElement){
        this.workingCanvas = canvas;
        this.workingWidth = canvas.width;
        this.workingHeight = canvas.height;
        this.workingContext = this.workingCanvas.getContext("2d")!;
        this.depthbuffer = new Array( this.workingWidth * this.workingHeight );
    }
    public clear(): void {
        this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
        this.backbuffer = this.workingContext.getImageData(0, 0, this.workingWidth, this.workingHeight);
        this.backbufferdata = this.backbuffer.data;
        for(var i = 0; i < this.depthbuffer.length ; i++){
            this.depthbuffer[i] = 10000000; 
        }
    }
    public present(): void {
        this.workingContext.putImageData(this.backbuffer,0 ,0);
    }
    public putPixel(x: number, y: number, z: number, color: Color4): void {
        const intX = x >> 0;
        const intY = y >> 0;
        const index = (intX + intY * this.workingWidth) * 4;
        const indexz = (intX + intY * this.workingWidth);

        if (this.depthbuffer[indexz] < z) {
            return; // Discard
        }
        this.depthbuffer[indexz] = z;

        this.backbufferdata[index]     = color.r * 255; 
        this.backbufferdata[index+1]   = color.g * 255;
        this.backbufferdata[index+2]   = color.b * 255;
        this.backbufferdata[index+3]   = color.a * 255;
    }
    public project(coord: Vector3, transMat: Matrix): Vector3 {
        const point = Vector3.TransformCoordinates(coord, transMat);
        const x = (point.x * this.workingWidth + this.workingWidth / 2.0) >> 0;
        const y = (-point.y * this.workingHeight + this.workingHeight / 2.0) >> 0;
        return new Vector3(x,y, point.z || 0);
    }
    public drawPoint(point: Vector3, color: Color4): void {
        if(point.x >= 0 && point.y >=0 && point.x < this.workingWidth && point.y < this.workingHeight){
            this.putPixel(point.x, point.y, point.z, color);
        }
    }
    // public drawLine(point0: Vector2, point1: Vector2) : void{
    //     const dist = point1.subtract(point0).length();
    //     if(dist<2){
    //         return ;
    //     }
    //     const middlePoint = point0.add(point1.subtract(point0).scale(0.5));
    //     this.drawPoint(middlePoint);
    //     this.drawLine(point0,middlePoint);
    //     this.drawLine(middlePoint,point1);
    // }
    // public drawBLine(point0: Vector2, point1: Vector2) : void {
    //     var x0 = point0.x >> 0;
    //     var y0 = point0.y >> 0;
    //     const x1 = point1.x >> 0;
    //     const y1 = point1.y >> 0;
    //     const dx = Math.abs(x1 - x0);
    //     const dy = Math.abs(y1 - y0);
    //     const sx = (x0 < x1) ? 1 : -1;
    //     const sy = (y0 < y1) ? 1 : -1;
    //     var err = dx - dy;
    //     while (true) {
    //         this.drawPoint(new Vector2(x0, y0));
    //         if ((x0 == x1) && (y0 == y1)) break;
    //         var e2 = 2 * err;
    //         if (e2 > -dy) { err -= dy; x0 += sx; }
    //         if (e2 < dx) { err += dx; y0 += sy; }
    //     }
    // }
    public clamp(value: number, min: number=0, max: number=1) : number {
        return Math.max(min, Math.min(value, max));
    }
    public interpolate(min: number, max: number, gradient: number) : number {
        return min + (max - min) * this.clamp(gradient);
    }
    public processScanLine(y: number, pa: Vector3, pb: Vector3, pc: Vector3, pd: Vector3, color: Color4) : void {
        const gradient1 = pa.y !== pb.y ? (y - pa.y) / (pb.y - pa.y) : 1;
        const gradient2 = pc.y !== pd.y ? (y - pc.y) / (pd.y - pc.y) : 1;
        let sx = this.interpolate(pa.x, pb.x, gradient1) >> 0;
        let ex = this.interpolate(pc.x, pd.x, gradient2) >> 0;
        const zStart = this.interpolate(pa.z, pb.z, gradient1);
        const zEnd = this.interpolate(pc.z, pd.z, gradient2);
        if (sx > ex) {
            const t = sx; sx = ex; ex = t;
        }
        for (let x = sx; x < ex; x++) {
            const gradX = ex !== sx ? (x - sx) / (ex - sx) : 0;
            const z = this.interpolate(zStart, zEnd, gradX);
            this.drawPoint(new Vector3(x, y, z), color);
        }
    }
    public drawTrinangle(p1: Vector3, p2: Vector3, p3: Vector3, color: Color4) : void {
        if (p1.y > p2.y) { let temp = p2; p2 = p1; p1 = temp; }
        if (p2.y > p3.y) { let temp = p2; p2 = p3; p3 = temp; }
        if (p1.y > p2.y) { let temp = p2; p2 = p1; p1 = temp; }
        let dP1P2 = p2.y - p1.y > 0 ? (p2.x - p1.x) / (p2.y - p1.y) : 0;
        let dP1P3 = p3.y - p1.y > 0 ? (p3.x - p1.x) / (p3.y - p1.y) : 0;
        const startY = p1.y >> 0;
        const endY = p3.y >> 0;
        if(dP1P2 > dP1P3){
            for(let y = startY;y <= endY; y++){
                if(y < p2.y){
                    this.processScanLine(y,p1,p3,p1,p2,color);
                }else{
                    this.processScanLine(y,p1,p3,p2,p3,color);
                }
            }
        }else{
            for (let y = startY; y <= endY; y++) {
                if (y < p2.y){
                    this.processScanLine(y, p1, p2, p1, p3, color);
                }else{
                    this.processScanLine(y, p2, p3, p1, p3, color);
                }
            }
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
                // this.drawBLine(pixelA, pixelB);
                // this.drawBLine(pixelB, pixelC);
                // this.drawBLine(pixelC, pixelA);
                const colorValue = 0.25 + ((indexFaces % cMesh.Faces.length) / cMesh.Faces.length) * 0.75;
                const faceColor = new Color4(colorValue, colorValue, colorValue, 1);
                this.drawTrinangle(pixelA, pixelB, pixelC, faceColor); 
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
