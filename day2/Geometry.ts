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

export interface Face {
    A : number;
    B : number;
    C : number;
}

export class Mesh {
    public name : string;
    public Vertices: Vector3[];
    public Faces : Face[];
    public Rotation: Vector3;
    public Position: Vector3;
    constructor(name: string, verticesCount: number, facesCount: number){
        this.name = name;
        this.Vertices = new Array<Vector3>(verticesCount);
        this.Faces = new Array<Face>(facesCount);
        this.Rotation = Vector3.Zero();
        this.Position = Vector3.Zero();
    }
}

// export class Mesh{
//     public name: string;
//     public Rotation: Vector3;
//     public Position: Vector3;
//     public Vertices: Vector3[];
//     constructor(name: string, verticesCount: number){
//         this.name = name;
//         this.Vertices = new Array<Vector3>(verticesCount);
//         this.Rotation = Vector3.Zero();
//         this.Position = Vector3.Zero();
//     }
// }

