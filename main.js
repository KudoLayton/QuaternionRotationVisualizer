import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Coordinate axes
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Grid helper on XY plane
const gridHelper = new THREE.GridHelper(10, 10);
gridHelper.rotation.x = Math.PI / 2;
gridHelper.position.z = 0;
scene.add(gridHelper);

// Parameters
let params = {
    theta: 0, // degrees
    dx: 1,
    dy: 0,
    vx: 2,
    vy: 1
};

// Visualization objects
let objects = {
    // Z-axis unit vector (identity element)
    zAxis: null,
    // Rotation axis D in XY plane
    axisD: null,
    // Point V to be rotated
    pointV: null,
    // Pseudo-quaternion Q visualization
    quaternionQ: null,
    // Q^(-1) visualization
    quaternionQInv: null,
    // Transformed Q (_Q) after QV operation
    transformedQ: null,
    // _Q projection on xy plane
    transformedQProjection: null,
    // Final result after QVQ^(-1)
    finalResult: null,
    // Final result projection
    finalResultProjection: null,
    // Coordinate system axes
    coordinateAxes: null,
    // Transformed coordinate system
    transformedAxes: null,
    // Second coordinate system (for QVQ^-1)
    transformedAxes2: null,
    // Identity element (1) for real quaternion mode
    identityOne: null,
    // Transformed identity (1 -> V or 1 -> Q^-1)
    transformedIdentity: null
};

// State
let showFinalResult = false;
let realQuaternionMode = false;

// Create Z-axis unit vector visualization
function createZAxisVector() {
    const geometry = new THREE.ConeGeometry(0.1, 0.3, 8);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const cone = new THREE.Mesh(geometry, material);
    cone.position.set(0, 0, 1.15);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 1)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const line = new THREE.Line(lineGeometry, lineMaterial);

    const group = new THREE.Group();
    group.add(line);
    group.add(cone);

    return group;
}

// Create rotation axis D visualization
function createAxisD(dx, dy) {
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return new THREE.Group();

    const nx = dx / length;
    const ny = dy / length;

    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-nx * 3, -ny * 3, 0),
        new THREE.Vector3(nx * 3, ny * 3, 0)
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 3 });
    const line = new THREE.Line(geometry, material);

    // Arrow at the end
    const arrowGeometry = new THREE.ConeGeometry(0.08, 0.25, 8);
    const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xff00ff });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(nx * 3, ny * 3, 0);

    // Rotate arrow to point in direction
    const angle = Math.atan2(ny, nx);
    arrow.rotation.z = angle - Math.PI / 2;

    const group = new THREE.Group();
    group.add(line);
    group.add(arrow);

    return group;
}

// Create point V visualization
function createPointV(x, y) {
    const geometry = new THREE.SphereGeometry(0.15, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, 0);

    // Add label
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(x, y, 0)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffff00,
        linewidth: 2,
        transparent: true,
        opacity: 0.5
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);

    const group = new THREE.Group();
    group.add(sphere);
    group.add(line);

    return group;
}

// Create pseudo-quaternion Q visualization
function createQuaternionQ(theta, dx, dy, color = 0x00ffff, label = 'Q') {
    const thetaRad = (theta * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);

    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return new THREE.Group();

    const nx = dx / length;
    const ny = dy / length;

    // Q = cos(θ)·ẑ + sin(θ)·D
    const qx = sinTheta * nx;
    const qy = sinTheta * ny;
    const qz = cosTheta;

    const geometry = new THREE.SphereGeometry(0.12, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(qx, qy, qz);

    // Vector from origin to Q
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(qx, qy, qz)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 3
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);

    const group = new THREE.Group();
    group.add(sphere);
    group.add(line);
    group.userData = { qx, qy, qz, label };

    return group;
}

// Create coordinate system axes visualization
function createCoordinateAxes(scale = 1, opacity = 1) {
    const group = new THREE.Group();

    const axisLength = 2 * scale;
    const arrowSize = 0.2 * scale;

    // X axis (red)
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(axisLength, 0, 0)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: opacity
    });
    const xLine = new THREE.Line(xGeometry, xMaterial);
    group.add(xLine);

    // Y axis (green)
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, axisLength, 0)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: opacity
    });
    const yLine = new THREE.Line(yGeometry, yMaterial);
    group.add(yLine);

    // Z axis (blue)
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, axisLength)
    ]);
    const zMaterial = new THREE.LineBasicMaterial({
        color: 0x0000ff,
        transparent: true,
        opacity: opacity
    });
    const zLine = new THREE.Line(zGeometry, zMaterial);
    group.add(zLine);

    return group;
}

// Calculate transformation matrix that maps z-axis to V (2D version - xy plane)
// Step 1: Rotate z-axis to V_normalized (EXACTLY 90 degrees)
// Step 2: Scale by V's length
function calculateTransformationMatrix(vx, vy) {
    const vLength = Math.sqrt(vx * vx + vy * vy);
    if (vLength === 0) return new THREE.Matrix4();

    // Step 1: Rotation - z-axis to V_normalized
    // z(0,0,1) → V(vx,vy,0) is ALWAYS 90 degrees geometrically
    const vNormalized = new THREE.Vector3(vx, vy, 0).normalize();
    const zAxis = new THREE.Vector3(0, 0, 1);

    // Rotation axis: z × V_normalized
    const rotationAxis = new THREE.Vector3().crossVectors(zAxis, vNormalized);

    // Create rotation matrix with EXACTLY 90 degrees (π/2 radians)
    const rotationMatrix = new THREE.Matrix4();
    if (rotationAxis.length() > 0.0001) {
        rotationAxis.normalize();
        rotationMatrix.makeRotationAxis(rotationAxis, Math.PI / 2); // Force 90 degrees
    }

    // Step 2: Uniform scaling by V's length
    const scaleMatrix = new THREE.Matrix4();
    scaleMatrix.makeScale(vLength, vLength, vLength);

    // Combine: Scale(Rotation(vector))
    const matrix = new THREE.Matrix4();
    matrix.multiplyMatrices(scaleMatrix, rotationMatrix);

    return matrix;
}

// Calculate transformation matrix that maps z-axis to any 3D point
// Step 1: Rotate z-axis to targetVec_normalized (using Quaternion for accuracy)
// Step 2: Scale by targetVec's length
function calculateTransformationMatrix3D(targetVec) {
    const vLength = targetVec.length();
    if (vLength === 0) return new THREE.Matrix4();

    // Step 1: Rotation - z-axis to targetVec_normalized using Quaternion
    const targetNormalized = targetVec.clone().normalize();
    const zAxis = new THREE.Vector3(0, 0, 1);

    // Create quaternion that rotates z-axis to target_normalized
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(zAxis, targetNormalized);

    // Convert quaternion to rotation matrix
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationFromQuaternion(quaternion);

    // Step 2: Uniform scaling by target's length
    const scaleMatrix = new THREE.Matrix4();
    scaleMatrix.makeScale(vLength, vLength, vLength);

    // Combine: Scale(Rotation(vector))
    const matrix = new THREE.Matrix4();
    matrix.multiplyMatrices(scaleMatrix, rotationMatrix);

    return matrix;
}

// Apply transformation to a point
function applyTransformation(point, matrix) {
    const vec = new THREE.Vector3(point.x, point.y, point.z);
    vec.applyMatrix4(matrix);
    return vec;
}

// Create projection of a point onto xy plane
function createProjectionPoint(x, y, z, color = 0xffaa00) {
    const group = new THREE.Group();

    // Projection point on xy plane
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshPhongMaterial({ color: color, opacity: 0.7, transparent: true })
    );
    sphere.position.set(x, y, 0);

    // Line from projection to original point
    const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, y, 0),
            new THREE.Vector3(x, y, z)
        ]),
        new THREE.LineDashedMaterial({
            color: color,
            dashSize: 0.1,
            gapSize: 0.05,
            opacity: 0.5,
            transparent: true
        })
    );
    line.computeLineDistances();

    group.add(sphere);
    group.add(line);

    return group;
}

// Create triangle visualization connecting three points
function createTriangle(p1, p2, p3, color = 0x00ffff, opacity = 0.3) {
    const group = new THREE.Group();

    // Create filled triangle
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Create outline
    const edgeGeometry = new THREE.BufferGeometry();
    const edgeVertices = new Float32Array([
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z,
        p3.x, p3.y, p3.z,
        p1.x, p1.y, p1.z
    ]);
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgeVertices, 3));

    const edgeMaterial = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity + 0.3,
        linewidth: 2
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    group.add(edges);

    return group;
}

// Update triangle vertices dynamically
function updateTriangle(triangleGroup, p1, p2, p3) {
    // Update filled triangle
    const mesh = triangleGroup.children[0];
    const positions = mesh.geometry.attributes.position.array;
    positions[0] = p1.x; positions[1] = p1.y; positions[2] = p1.z;
    positions[3] = p2.x; positions[4] = p2.y; positions[5] = p2.z;
    positions[6] = p3.x; positions[7] = p3.y; positions[8] = p3.z;
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();

    // Update edges
    const edges = triangleGroup.children[1];
    const edgePositions = edges.geometry.attributes.position.array;
    edgePositions[0] = p1.x; edgePositions[1] = p1.y; edgePositions[2] = p1.z;
    edgePositions[3] = p2.x; edgePositions[4] = p2.y; edgePositions[5] = p2.z;
    edgePositions[6] = p2.x; edgePositions[7] = p2.y; edgePositions[8] = p2.z;
    edgePositions[9] = p3.x; edgePositions[10] = p3.y; edgePositions[11] = p3.z;
    edgePositions[12] = p3.x; edgePositions[13] = p3.y; edgePositions[14] = p3.z;
    edgePositions[15] = p1.x; edgePositions[16] = p1.y; edgePositions[17] = p1.z;
    edges.geometry.attributes.position.needsUpdate = true;
}

// Update angle display in UI
function updateAngleDisplay() {
    const angleQQtElem = document.getElementById('angle-q-qt');
    const angleQFinalElem = document.getElementById('angle-q-final');
    const angleQtFinalElem = document.getElementById('angle-qt-final');

    if (!angleQQtElem || !angleQFinalElem || !angleQtFinalElem) {
        console.error('Angle display elements not found');
        return;
    }

    if (!showFinalResult) {
        angleQQtElem.textContent = '-';
        angleQFinalElem.textContent = '-';
        angleQtFinalElem.textContent = '-';
        return;
    }

    try {
        if (realQuaternionMode) {
            // Real quaternion mode
            const result = calculateRealQVQResult();

            // Q ↔ QV angle
            const angleQtoQV = Math.acos(
                Math.max(-1, Math.min(1, result.qPos.clone().normalize().dot(result.qvPos.clone().normalize())))
            ) * (180 / Math.PI);

            // Q ↔ Final angle
            const angleQtoFinal = Math.acos(
                Math.max(-1, Math.min(1, result.qPos.clone().normalize().dot(result.finalPos.clone().normalize())))
            ) * (180 / Math.PI);

            // QV ↔ Final angle
            const angleQVtoFinal = Math.acos(
                Math.max(-1, Math.min(1, result.qvPos.clone().normalize().dot(result.finalPos.clone().normalize())))
            ) * (180 / Math.PI);

            angleQQtElem.textContent = angleQtoQV.toFixed(2) + '°';
            angleQFinalElem.textContent = angleQtoFinal.toFixed(2) + '°';
            angleQtFinalElem.textContent = angleQVtoFinal.toFixed(2) + '°';

            console.log('[Real Quat] Angles:', angleQtoQV.toFixed(2), angleQtoFinal.toFixed(2), angleQVtoFinal.toFixed(2));
        } else {
            // Pseudo-quaternion mode
            const result = calculateQVQResult();

            // Calculate angles
            const angleQtoQT = Math.acos(
                Math.max(-1, Math.min(1, result.qPos.clone().normalize().dot(result.transformedQPos.clone().normalize())))
            ) * (180 / Math.PI);

            const angleQtoFinal = Math.acos(
                Math.max(-1, Math.min(1, result.qPos.clone().normalize().dot(result.finalPos.clone().normalize())))
            ) * (180 / Math.PI);

            const angleQTtoFinal = Math.acos(
                Math.max(-1, Math.min(1, result.transformedQPos.clone().normalize().dot(result.finalPos.clone().normalize())))
            ) * (180 / Math.PI);

            angleQQtElem.textContent = angleQtoQT.toFixed(2) + '°';
            angleQFinalElem.textContent = angleQtoFinal.toFixed(2) + '°';
            angleQtFinalElem.textContent = angleQTtoFinal.toFixed(2) + '°';

            console.log('[Pseudo Quat] Angles:', angleQtoQT.toFixed(2), angleQtoFinal.toFixed(2), angleQTtoFinal.toFixed(2));
        }
    } catch (error) {
        console.error('Error updating angles:', error);
    }
}

// ============================================
// Real Quaternion Functions
// ============================================

// Quaternion class for real quaternion operations
class Quat {
    constructor(w, x, y, z) {
        this.w = w; // real part
        this.x = x; // i component
        this.y = y; // j component
        this.z = z; // k component
    }

    // Multiply two quaternions: this * other
    multiply(other) {
        const w = this.w * other.w - this.x * other.x - this.y * other.y - this.z * other.z;
        const x = this.w * other.x + this.x * other.w + this.y * other.z - this.z * other.y;
        const y = this.w * other.y - this.x * other.z + this.y * other.w + this.z * other.x;
        const z = this.w * other.z + this.x * other.y - this.y * other.x + this.z * other.w;
        return new Quat(w, x, y, z);
    }

    // Conjugate (inverse for unit quaternion)
    conjugate() {
        return new Quat(this.w, -this.x, -this.y, -this.z);
    }

    // Get 3D position for visualization (z=w, x=i, y=j, ignoring k)
    toVisualPosition() {
        return new THREE.Vector3(this.x, this.y, this.w);
    }

    // Get length
    length() {
        return Math.sqrt(this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z);
    }

    // Normalize
    normalize() {
        const len = this.length();
        if (len === 0) return new Quat(1, 0, 0, 0);
        return new Quat(this.w / len, this.x / len, this.y / len, this.z / len);
    }

    toString() {
        return `(${this.w.toFixed(3)} + ${this.x.toFixed(3)}i + ${this.y.toFixed(3)}j + ${this.z.toFixed(3)}k)`;
    }
}

// Create rotation quaternion Q = cos(θ/2) + sin(θ/2)·(xi + yj + zk)
function createRotationQuaternion(theta, dx, dy) {
    const thetaRad = (theta * Math.PI) / 180;
    const halfTheta = thetaRad / 2;
    const cosHalf = Math.cos(halfTheta);
    const sinHalf = Math.sin(halfTheta);

    // Normalize the axis direction (dx, dy, 0)
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return new Quat(1, 0, 0, 0);

    const nx = dx / length;
    const ny = dy / length;

    // Q = cos(θ/2) + sin(θ/2)·(nx·i + ny·j + 0·k)
    return new Quat(cosHalf, sinHalf * nx, sinHalf * ny, 0);
}

// Create pure quaternion from point V (0 + vx·i + vy·j + 0·k)
function createPureQuaternion(vx, vy) {
    return new Quat(0, vx, vy, 0);
}

// Calculate real quaternion QVQ^(-1) result
function calculateRealQVQResult() {
    const Q = createRotationQuaternion(params.theta, params.dx, params.dy);
    const V = createPureQuaternion(params.vx, params.vy);
    const QInv = Q.conjugate();

    // QV
    const QV = Q.multiply(V);
    // QVQ^(-1)
    const QVQInv = QV.multiply(QInv);

    console.log('=== Real Quaternion Calculation ===');
    console.log('Q:', Q.toString());
    console.log('V:', V.toString());
    console.log('Q^(-1):', QInv.toString());
    console.log('QV:', QV.toString());
    console.log('QVQ^(-1):', QVQInv.toString());

    return {
        Q,
        V,
        QInv,
        QV,
        QVQInv,
        qPos: Q.toVisualPosition(),
        vPos: V.toVisualPosition(),
        qInvPos: QInv.toVisualPosition(),
        qvPos: QV.toVisualPosition(),
        finalPos: QVQInv.toVisualPosition()
    };
}

// Create visualization for real quaternion point
function createRealQuaternionPoint(quat, color, label = '') {
    const pos = quat.toVisualPosition();

    const geometry = new THREE.SphereGeometry(0.12, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(pos);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        pos
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
    const line = new THREE.Line(lineGeometry, lineMaterial);

    const group = new THREE.Group();
    group.add(sphere);
    group.add(line);
    group.userData = { quat, label };

    return group;
}

// Create identity element (1) visualization - white sphere at (0, 0, 1)
function createIdentityElement() {
    const identity = new Quat(1, 0, 0, 0);
    const pos = identity.toVisualPosition(); // (0, 0, 1)

    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(pos);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        pos
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.7
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);

    const group = new THREE.Group();
    group.add(sphere);
    group.add(line);
    group.userData = { quat: identity, label: '1' };

    return group;
}

// Calculate QVQ^(-1) result (pseudo-quaternion version)
function calculateQVQResult() {
    const thetaRad = (params.theta * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);
    const dLength = Math.sqrt(params.dx * params.dx + params.dy * params.dy);
    if (dLength === 0) return new THREE.Vector3(0, 0, 0);

    const nx = params.dx / dLength;
    const ny = params.dy / dLength;

    // Q position
    const qPos = new THREE.Vector3(
        sinTheta * nx,
        sinTheta * ny,
        cosTheta
    );

    // Q^(-1) position
    const qInvPos = new THREE.Vector3(
        -sinTheta * nx,
        -sinTheta * ny,
        cosTheta
    );

    // First transformation: z-axis to V
    const transformMatrix1 = calculateTransformationMatrix(params.vx, params.vy);
    const transformedQPos = applyTransformation(qPos, transformMatrix1);

    // Second transformation: z-axis to Q^(-1)
    const transformMatrix2 = calculateTransformationMatrix3D(qInvPos);
    const finalPos = applyTransformation(transformedQPos, transformMatrix2);

    return { qPos, qInvPos, transformedQPos, finalPos };
}

// Initialize visualization objects
function initObjects() {
    // Remove existing objects
    Object.values(objects).forEach(obj => {
        if (obj) scene.remove(obj);
    });

    if (realQuaternionMode) {
        initRealQuaternionObjects();
    } else {
        initPseudoQuaternionObjects();
    }
}

// Initialize pseudo-quaternion visualization objects
function initPseudoQuaternionObjects() {
    // Create new objects
    objects.zAxis = createZAxisVector();
    scene.add(objects.zAxis);

    objects.axisD = createAxisD(params.dx, params.dy);
    scene.add(objects.axisD);

    objects.pointV = createPointV(params.vx, params.vy);
    scene.add(objects.pointV);

    objects.quaternionQ = createQuaternionQ(params.theta, params.dx, params.dy, 0x00ffff, 'Q');
    scene.add(objects.quaternionQ);

    // Add Q^(-1) visualization
    const thetaRad = (params.theta * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);
    const dLength = Math.sqrt(params.dx * params.dx + params.dy * params.dy);
    if (dLength > 0) {
        const nx = params.dx / dLength;
        const ny = params.dy / dLength;

        objects.quaternionQInv = createQuaternionQ(
            -params.theta, // negative angle for visualization
            params.dx,
            params.dy,
            0xff00aa, // pink color
            'Q^(-1)'
        );
        scene.add(objects.quaternionQInv);
    }

    // Show final result if checkbox is checked
    if (showFinalResult) {
        const result = calculateQVQResult();

        // Show _Q projection on xy plane
        objects.transformedQProjection = createProjectionPoint(
            result.transformedQPos.x,
            result.transformedQPos.y,
            result.transformedQPos.z,
            0xff6600
        );
        scene.add(objects.transformedQProjection);

        // Show final result
        const finalGroup = new THREE.Group();
        const finalSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 16, 16),
            new THREE.MeshPhongMaterial({ color: 0x00ff00 })
        );
        finalSphere.position.copy(result.finalPos);

        const finalLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                result.finalPos
            ]),
            new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
        );

        finalGroup.add(finalSphere);
        finalGroup.add(finalLine);
        objects.finalResult = finalGroup;
        scene.add(objects.finalResult);
    }
}

// Initialize real quaternion visualization objects
function initRealQuaternionObjects() {
    // In real quaternion mode:
    // - z-axis represents real (w) component
    // - x-axis represents i component
    // - y-axis represents j component
    // - k component is not visualized

    // Create rotation axis D (in xy plane)
    objects.axisD = createAxisD(params.dx, params.dy);
    scene.add(objects.axisD);

    // Calculate real quaternion values
    const result = calculateRealQVQResult();

    // Create identity element (1) visualization - white sphere
    objects.identityOne = createIdentityElement();
    scene.add(objects.identityOne);

    // Create Q = cos(θ/2) + sin(θ/2)·D visualization (cyan)
    objects.quaternionQ = createRealQuaternionPoint(result.Q, 0x00ffff, 'Q');
    scene.add(objects.quaternionQ);

    // Create Q^(-1) visualization (pink)
    objects.quaternionQInv = createRealQuaternionPoint(result.QInv, 0xff00aa, 'Q^(-1)');
    scene.add(objects.quaternionQInv);

    // Create V as pure quaternion (yellow) - positioned on xy plane (z=0 since w=0)
    objects.pointV = createRealQuaternionPoint(result.V, 0xffff00, 'V');
    scene.add(objects.pointV);

    // Show intermediate and final results if checkbox is checked
    if (showFinalResult) {
        // Show QV (intermediate result - orange)
        objects.transformedQ = createRealQuaternionPoint(result.QV, 0xff6600, 'QV');
        scene.add(objects.transformedQ);

        // Show QV projection on xy plane (w=0 plane)
        objects.transformedQProjection = createProjectionPoint(
            result.qvPos.x,
            result.qvPos.y,
            result.qvPos.z,
            0xff6600
        );
        scene.add(objects.transformedQProjection);

        // Show QVQ^(-1) (final result - green)
        const finalGroup = new THREE.Group();
        const finalSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 16, 16),
            new THREE.MeshPhongMaterial({ color: 0x00ff00 })
        );
        finalSphere.position.copy(result.finalPos);

        const finalLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                result.finalPos
            ]),
            new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
        );

        finalGroup.add(finalSphere);
        finalGroup.add(finalLine);
        objects.finalResult = finalGroup;
        scene.add(objects.finalResult);

        // Show final result projection on xy plane
        objects.finalResultProjection = createProjectionPoint(
            result.finalPos.x,
            result.finalPos.y,
            result.finalPos.z,
            0x00ff00
        );
        scene.add(objects.finalResultProjection);
    }
}

// Update visualization based on current parameters
function updateVisualization() {
    initObjects();
    updateAngleDisplay();
}

// UI Controls
const thetaSlider = document.getElementById('theta');
const dxSlider = document.getElementById('dx');
const dySlider = document.getElementById('dy');
const vxSlider = document.getElementById('vx');
const vySlider = document.getElementById('vy');

const thetaValue = document.getElementById('theta-value');
const dxValue = document.getElementById('dx-value');
const dyValue = document.getElementById('dy-value');
const vxValue = document.getElementById('vx-value');
const vyValue = document.getElementById('vy-value');

thetaSlider.addEventListener('input', (e) => {
    params.theta = parseFloat(e.target.value);
    thetaValue.textContent = params.theta.toFixed(0) + '°';
    updateVisualization();
});

dxSlider.addEventListener('input', (e) => {
    params.dx = parseFloat(e.target.value) / 100;
    dxValue.textContent = params.dx.toFixed(2);
    updateVisualization();
});

dySlider.addEventListener('input', (e) => {
    params.dy = parseFloat(e.target.value) / 100;
    dyValue.textContent = params.dy.toFixed(2);
    updateVisualization();
});

vxSlider.addEventListener('input', (e) => {
    params.vx = parseFloat(e.target.value) / 100;
    vxValue.textContent = params.vx.toFixed(2);
    updateVisualization();
});

vySlider.addEventListener('input', (e) => {
    params.vy = parseFloat(e.target.value) / 100;
    vyValue.textContent = params.vy.toFixed(2);
    updateVisualization();
});

// Real quaternion mode checkbox
const realQuaternionModeCheckbox = document.getElementById('real-quaternion-mode');
realQuaternionModeCheckbox.addEventListener('change', (e) => {
    realQuaternionMode = e.target.checked;
    console.log('Real Quaternion Mode:', realQuaternionMode ? 'ON' : 'OFF');

    // Toggle info panel
    const pseudoInfo = document.getElementById('pseudo-mode-info');
    const realInfo = document.getElementById('real-mode-info');
    if (pseudoInfo && realInfo) {
        pseudoInfo.style.display = realQuaternionMode ? 'none' : 'block';
        realInfo.style.display = realQuaternionMode ? 'block' : 'none';
    }

    // Update angle labels
    const label1 = document.getElementById('angle-label-1');
    const label2 = document.getElementById('angle-label-2');
    const label3 = document.getElementById('angle-label-3');
    if (label1 && label2 && label3) {
        if (realQuaternionMode) {
            label1.textContent = 'Q ↔ QV';
            label2.textContent = 'Q ↔ Final';
            label3.textContent = 'QV ↔ Final';
        } else {
            label1.textContent = 'Q ↔ _Q';
            label2.textContent = 'Q ↔ Final';
            label3.textContent = '_Q ↔ Final';
        }
    }

    updateVisualization();
});

// Show final result checkbox
const showFinalResultCheckbox = document.getElementById('show-final-result');
showFinalResultCheckbox.addEventListener('change', (e) => {
    showFinalResult = e.target.checked;
    updateVisualization();
});

// Animation state
let isAnimating = false;
let animationProgress = 0;

// Animate QV operation
document.getElementById('animate-qv').addEventListener('click', () => {
    if (isAnimating) return;
    animateQV();
});

// Animate QVQ^(-1) operation
document.getElementById('animate-qvq').addEventListener('click', () => {
    if (isAnimating) return;
    animateQVQ();
});

// Reset button
document.getElementById('reset').addEventListener('click', () => {
    params.theta = 0;
    params.dx = 1;
    params.dy = 0;
    params.vx = 2;
    params.vy = 1;

    thetaSlider.value = 0;
    dxSlider.value = 100;
    dySlider.value = 0;
    vxSlider.value = 200;
    vySlider.value = 100;

    thetaValue.textContent = '0°';
    dxValue.textContent = '1.00';
    dyValue.textContent = '0.00';
    vxValue.textContent = '2.00';
    vyValue.textContent = '1.00';

    updateVisualization();
});

// QV Animation
function animateQV() {
    if (realQuaternionMode) {
        animateRealQV();
    } else {
        animatePseudoQV();
    }
}

// Real Quaternion QV Animation
function animateRealQV() {
    isAnimating = true;
    animationProgress = 0;

    console.log('=== Real Quaternion QV 연산 시작 ===');
    console.log('Q * V = QV (quaternion multiplication)');
    console.log('동시에 1 * V = V 변환도 보여줍니다 (항등원의 관점)');
    console.log('색상 변화: 스케일이 변하므로 색상도 변함');

    const result = calculateRealQVQResult();

    console.log('V quaternion:', result.V.toString());
    console.log('V visual position:', result.vPos);
    console.log('QV quaternion:', result.QV.toString());
    console.log('QV visual position:', result.qvPos);

    // Identity element position (1, 0, 0, 0) -> visual (0, 0, 1)
    const identityPos = new THREE.Vector3(0, 0, 1);
    const vPos = result.vPos.clone();
    const qPos = result.qPos.clone();
    const qvPos = result.qvPos.clone();

    // Colors for interpolation
    const colorIdentityStart = new THREE.Color(0xaaaaaa); // gray
    const colorIdentityEnd = new THREE.Color(0xffff00);   // yellow (V's color)
    const colorQStart = new THREE.Color(0x00ffff);        // cyan (Q's color)
    const colorQEnd = new THREE.Color(0xff6600);          // orange (QV's color)

    // Create QV visualization (Q -> QV) - starts cyan, ends orange
    if (objects.transformedQ) scene.remove(objects.transformedQ);
    objects.transformedQ = new THREE.Group();
    const qvSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorQStart.clone() })
    );
    const qvLineGeometry = new THREE.BufferGeometry();
    const qvPositions = new Float32Array(6);
    qvLineGeometry.setAttribute('position', new THREE.BufferAttribute(qvPositions, 3));
    const qvLine = new THREE.Line(
        qvLineGeometry,
        new THREE.LineBasicMaterial({ color: colorQStart.clone(), linewidth: 3 })
    );
    objects.transformedQ.add(qvSphere);
    objects.transformedQ.add(qvLine);
    objects.transformedQ.visible = false;
    scene.add(objects.transformedQ);

    // Create transformed identity visualization (1 -> V) - starts gray, ends yellow
    if (objects.transformedIdentity) scene.remove(objects.transformedIdentity);
    objects.transformedIdentity = new THREE.Group();
    const identitySphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorIdentityStart.clone(), transparent: true, opacity: 0.8 })
    );
    const identityLineGeometry = new THREE.BufferGeometry();
    const identityPositions = new Float32Array(6);
    identityLineGeometry.setAttribute('position', new THREE.BufferAttribute(identityPositions, 3));
    const identityLine = new THREE.Line(
        identityLineGeometry,
        new THREE.LineDashedMaterial({ color: colorIdentityStart.clone(), linewidth: 2, dashSize: 0.1, gapSize: 0.05 })
    );
    objects.transformedIdentity.add(identitySphere);
    objects.transformedIdentity.add(identityLine);
    objects.transformedIdentity.visible = false;
    scene.add(objects.transformedIdentity);

    // Create triangle (identity, origin, Q) for transformation visualization
    const origin = new THREE.Vector3(0, 0, 0);
    const triangleGroup = createTriangle(identityPos, origin, qPos, 0x00ffff, 0.25);
    scene.add(triangleGroup);

    const duration = 3000;
    const startTime = Date.now();

    function updateLineGeometry(line, endPos) {
        const posArray = line.geometry.attributes.position.array;
        posArray[0] = 0; posArray[1] = 0; posArray[2] = 0;
        posArray[3] = endPos.x;
        posArray[4] = endPos.y;
        posArray[5] = endPos.z;
        line.geometry.attributes.position.needsUpdate = true;
        if (line.computeLineDistances) line.computeLineDistances();
    }

    function updateColor(group, color) {
        group.children[0].material.color.copy(color);
        group.children[1].material.color.copy(color);
    }

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        if (t < 0.33) {
            // Phase 1: Show initial state (1, Q, V) with triangle
            objects.transformedQ.visible = false;
            objects.transformedIdentity.visible = false;
            triangleGroup.visible = true;
        } else if (t < 0.67) {
            // Phase 2: Animate Q -> QV and 1 -> V simultaneously (with color change for scale)
            const phaseT = (t - 0.33) / 0.34;
            const phaseEased = phaseT < 0.5 ? 2 * phaseT * phaseT : 1 - Math.pow(-2 * phaseT + 2, 2) / 2;

            triangleGroup.visible = true;

            // Q -> QV animation with color change (cyan -> orange)
            objects.transformedQ.visible = true;
            const interpolatedQV = new THREE.Vector3();
            interpolatedQV.lerpVectors(qPos, qvPos, phaseEased);
            objects.transformedQ.children[0].position.copy(interpolatedQV);
            updateLineGeometry(objects.transformedQ.children[1], interpolatedQV);
            // Color interpolation for scale change
            const currentColorQ = colorQStart.clone().lerp(colorQEnd, phaseEased);
            updateColor(objects.transformedQ, currentColorQ);

            // 1 -> V animation with color change (gray -> yellow)
            objects.transformedIdentity.visible = true;
            const interpolatedIdentity = new THREE.Vector3();
            interpolatedIdentity.lerpVectors(identityPos, vPos, phaseEased);
            objects.transformedIdentity.children[0].position.copy(interpolatedIdentity);
            updateLineGeometry(objects.transformedIdentity.children[1], interpolatedIdentity);
            // Color interpolation for scale change
            const currentColorIdentity = colorIdentityStart.clone().lerp(colorIdentityEnd, phaseEased);
            updateColor(objects.transformedIdentity, currentColorIdentity);

            // Update triangle: (identity, origin, Q) -> (V, origin, QV)
            updateTriangle(triangleGroup, interpolatedIdentity, origin, interpolatedQV);
        } else {
            // Phase 3: Show final state with final colors
            objects.transformedQ.visible = true;
            objects.transformedQ.children[0].position.copy(qvPos);
            updateLineGeometry(objects.transformedQ.children[1], qvPos);
            updateColor(objects.transformedQ, colorQEnd);

            objects.transformedIdentity.visible = true;
            objects.transformedIdentity.children[0].position.copy(vPos);
            updateLineGeometry(objects.transformedIdentity.children[1], vPos);
            updateColor(objects.transformedIdentity, colorIdentityEnd);

            // Show final triangle
            triangleGroup.visible = true;
            updateTriangle(triangleGroup, vPos, origin, qvPos);
        }

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            // Clean up triangle
            scene.remove(triangleGroup);
            console.log('Real QV animation complete');
            console.log('Q -> QV:', qvPos);
            console.log('1 -> V:', vPos);
        }
    }

    animate();
}

// Pseudo-Quaternion QV Animation
function animatePseudoQV() {
    isAnimating = true;
    animationProgress = 0;

    console.log('=== QV 연산 시작 ===');
    console.log('Step 1: 단위 z축 벡터와 Q가 있는 좌표계');
    console.log('Step 2: 단위 z축 벡터를 V 위치로 좌표계 전체 선형 변환');
    console.log('Step 3: 변환된 Q 위치(_Q) 확인');

    // Calculate transformation matrix
    const transformMatrix = calculateTransformationMatrix(params.vx, params.vy);

    // Get Q position
    const thetaRad = (params.theta * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);
    const dLength = Math.sqrt(params.dx * params.dx + params.dy * params.dy);
    const nx = params.dx / dLength;
    const ny = params.dy / dLength;
    const qPos = new THREE.Vector3(
        sinTheta * nx,
        sinTheta * ny,
        cosTheta
    );

    // Calculate transformed Q position
    const transformedQPos = applyTransformation(qPos, transformMatrix);

    // Debug transformation matrix
    console.log('\n[디버그] 변환 행렬 분해:');
    const debugPos = new THREE.Vector3();
    const debugQuat = new THREE.Quaternion();
    const debugScale = new THREE.Vector3();
    transformMatrix.decompose(debugPos, debugQuat, debugScale);
    console.log('  위치:', debugPos);
    console.log('  회전(quaternion):', debugQuat);
    console.log('  스케일:', debugScale);

    // Verify transformation
    const zAxis = new THREE.Vector3(0, 0, 1);
    const verifyV = applyTransformation(zAxis, transformMatrix);
    console.log('\n[검증 1] z축 (0, 0, 1) → V:', verifyV);
    console.log('예상 V:', params.vx, params.vy, 0);
    console.log('일치?', Math.abs(verifyV.x - params.vx) < 0.001 && Math.abs(verifyV.y - params.vy) < 0.001 && Math.abs(verifyV.z) < 0.001);

    console.log('\n[검증 2] 변환의 각도와 스케일:');
    const vVec = new THREE.Vector3(params.vx, params.vy, 0);
    const angleZtoV = Math.acos(zAxis.dot(vVec.clone().normalize())) * (180 / Math.PI);
    const scaleZtoV = vVec.length() / zAxis.length();
    console.log('  z → V 각도:', angleZtoV.toFixed(2), '°');
    console.log('  z → V 스케일:', scaleZtoV.toFixed(3));
    console.log('  z 길이:', zAxis.length().toFixed(3));
    console.log('  V 길이:', vVec.length().toFixed(3));

    console.log('  Q:', qPos);
    console.log('  Q 길이:', qPos.length().toFixed(3));
    console.log('  _Q:', transformedQPos);
    console.log('  _Q 길이:', transformedQPos.length().toFixed(3));

    const angleQtoQT = Math.acos(
        Math.max(-1, Math.min(1, qPos.clone().normalize().dot(transformedQPos.clone().normalize())))
    ) * (180 / Math.PI);
    const scaleQtoQT = transformedQPos.length() / qPos.length();
    console.log('  Q → _Q 각도:', angleQtoQT.toFixed(2), '°');
    console.log('  Q → _Q 스케일:', scaleQtoQT.toFixed(3));
    console.log('  각도 일치?', Math.abs(angleZtoV - angleQtoQT) < 0.1);
    console.log('  스케일 일치?', Math.abs(scaleZtoV - scaleQtoQT) < 0.001);

    // Manual verification: apply only rotation first
    console.log('\n[수동 검증] 회전만 적용:');
    const rotationOnlyMatrix = new THREE.Matrix4();
    const targetNorm = vVec.clone().normalize();
    const rotAxis = new THREE.Vector3().crossVectors(zAxis, targetNorm);
    const rotAngle = Math.acos(zAxis.dot(targetNorm));
    console.log('  회전축:', rotAxis);
    console.log('  회전 각도(라디안):', rotAngle, '=', (rotAngle * 180 / Math.PI).toFixed(2), '°');
    if (rotAxis.length() > 0.0001) {
        rotAxis.normalize();
        rotationOnlyMatrix.makeRotationAxis(rotAxis, rotAngle);
        const zRotated = applyTransformation(zAxis, rotationOnlyMatrix);
        const qRotated = applyTransformation(qPos, rotationOnlyMatrix);
        console.log('  z(회전만):', zRotated);
        console.log('  Q(회전만):', qRotated);
        const angleAfterRot = Math.acos(
            Math.max(-1, Math.min(1, qPos.clone().normalize().dot(qRotated.clone().normalize())))
        ) * (180 / Math.PI);
        console.log('  Q → Q(회전만) 각도:', angleAfterRot.toFixed(2), '°');
    }

    // Create transformed coordinate axes
    if (objects.transformedAxes) scene.remove(objects.transformedAxes);
    objects.transformedAxes = createCoordinateAxes(1, 0.5);
    objects.transformedAxes.visible = false;
    scene.add(objects.transformedAxes);

    // Colors for interpolation (scale change visualization)
    const colorQStart = new THREE.Color(0x00ffff);        // cyan (Q's color)
    const colorQEnd = new THREE.Color(0xff6600);          // orange (_Q's color)
    const colorIdentityStart = new THREE.Color(0x00ff00); // green (z-axis color)
    const colorIdentityEnd = new THREE.Color(0xffff00);   // yellow (V's color)

    // Create transformed Q with dynamic color
    if (objects.transformedQ) scene.remove(objects.transformedQ);
    const transformedQGroup = new THREE.Group();
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorQStart.clone() })
    );
    sphere.position.copy(transformedQPos);
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(6);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const line = new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({ color: colorQStart.clone(), linewidth: 3 })
    );
    transformedQGroup.add(sphere);
    transformedQGroup.add(line);
    transformedQGroup.visible = false;
    scene.add(transformedQGroup);
    objects.transformedQ = transformedQGroup;

    // Create transformed identity (z-axis -> V) visualization
    if (objects.transformedIdentity) scene.remove(objects.transformedIdentity);
    objects.transformedIdentity = new THREE.Group();
    const identitySphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorIdentityStart.clone(), transparent: true, opacity: 0.8 })
    );
    const identityLineGeometry = new THREE.BufferGeometry();
    const identityLinePositions = new Float32Array(6);
    identityLineGeometry.setAttribute('position', new THREE.BufferAttribute(identityLinePositions, 3));
    const identityLine = new THREE.Line(
        identityLineGeometry,
        new THREE.LineDashedMaterial({ color: colorIdentityStart.clone(), linewidth: 2, dashSize: 0.1, gapSize: 0.05 })
    );
    objects.transformedIdentity.add(identitySphere);
    objects.transformedIdentity.add(identityLine);
    objects.transformedIdentity.visible = false;
    scene.add(objects.transformedIdentity);

    // V position for identity transformation target
    const vPos = new THREE.Vector3(params.vx, params.vy, 0);

    // Create triangle (identity, origin, Q) for transformation visualization
    const origin = new THREE.Vector3(0, 0, 0);
    const triangleGroup = createTriangle(zAxis, origin, qPos, 0x00ffff, 0.25);
    scene.add(triangleGroup);

    console.log('Q:', qPos);
    console.log('_Q (변환 후):', transformedQPos);
    console.log('색상 변화: 스케일이 변하므로 색상도 변함');

    const duration = 3000; // 3 seconds
    const startTime = Date.now();

    function updateLineGeometry(lineObj, endPos) {
        const posArray = lineObj.geometry.attributes.position.array;
        posArray[0] = 0; posArray[1] = 0; posArray[2] = 0;
        posArray[3] = endPos.x;
        posArray[4] = endPos.y;
        posArray[5] = endPos.z;
        lineObj.geometry.attributes.position.needsUpdate = true;
        if (lineObj.computeLineDistances) lineObj.computeLineDistances();
    }

    function updateColor(group, color) {
        group.children[0].material.color.copy(color);
        group.children[1].material.color.copy(color);
    }

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        animationProgress = t;

        // Easing function (smooth in-out)
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        if (t < 0.33) {
            // Phase 1: Show initial state with triangle
            objects.transformedAxes.visible = false;
            objects.transformedQ.visible = false;
            objects.transformedIdentity.visible = false;
            triangleGroup.visible = true;
        } else if (t < 0.67) {
            // Phase 2: Transform coordinate system with color change
            const phaseT = (t - 0.33) / 0.34;
            const phaseEased = phaseT < 0.5 ? 2 * phaseT * phaseT : 1 - Math.pow(-2 * phaseT + 2, 2) / 2;

            objects.transformedAxes.visible = true;
            triangleGroup.visible = true;

            // Extract position, rotation, scale from transformation matrix
            const targetPos = new THREE.Vector3();
            const targetQuat = new THREE.Quaternion();
            const targetScale = new THREE.Vector3();
            transformMatrix.decompose(targetPos, targetQuat, targetScale);

            // Interpolate position
            const currentPos = new THREE.Vector3(0, 0, 0);
            currentPos.lerp(targetPos, phaseEased);

            // Interpolate rotation
            const identityQuat = new THREE.Quaternion();
            const currentQuat = new THREE.Quaternion();
            currentQuat.slerpQuaternions(identityQuat, targetQuat, phaseEased);

            // Interpolate scale
            const currentScale = new THREE.Vector3(1, 1, 1);
            currentScale.lerp(targetScale, phaseEased);

            // Apply to transformed axes
            objects.transformedAxes.position.copy(currentPos);
            objects.transformedAxes.quaternion.copy(currentQuat);
            objects.transformedAxes.scale.copy(currentScale);

            // Transform Q with color change (cyan -> orange)
            const interpolatedQPos = new THREE.Vector3();
            interpolatedQPos.lerpVectors(qPos, transformedQPos, phaseEased);
            transformedQGroup.children[0].position.copy(interpolatedQPos);
            updateLineGeometry(transformedQGroup.children[1], interpolatedQPos);
            const currentColorQ = colorQStart.clone().lerp(colorQEnd, phaseEased);
            updateColor(objects.transformedQ, currentColorQ);
            objects.transformedQ.visible = true;

            // Transform identity (z-axis -> V) with color change (green -> yellow)
            const interpolatedIdentityPos = new THREE.Vector3();
            interpolatedIdentityPos.lerpVectors(zAxis, vPos, phaseEased);
            objects.transformedIdentity.children[0].position.copy(interpolatedIdentityPos);
            updateLineGeometry(objects.transformedIdentity.children[1], interpolatedIdentityPos);
            const currentColorIdentity = colorIdentityStart.clone().lerp(colorIdentityEnd, phaseEased);
            updateColor(objects.transformedIdentity, currentColorIdentity);
            objects.transformedIdentity.visible = true;

            // Update triangle: (identity, origin, Q) -> (V, origin, _Q)
            updateTriangle(triangleGroup, interpolatedIdentityPos, origin, interpolatedQPos);
        } else {
            // Phase 3: Show final result with final colors
            objects.transformedAxes.visible = true;
            objects.transformedQ.visible = true;
            updateColor(objects.transformedQ, colorQEnd);

            objects.transformedIdentity.visible = true;
            objects.transformedIdentity.children[0].position.copy(vPos);
            updateLineGeometry(objects.transformedIdentity.children[1], vPos);
            updateColor(objects.transformedIdentity, colorIdentityEnd);

            // Show final triangle
            triangleGroup.visible = true;
            updateTriangle(triangleGroup, vPos, origin, transformedQPos);
        }

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            // Clean up triangle
            scene.remove(triangleGroup);
            console.log('QV animation complete');
            console.log('Transformed Q position:', transformedQPos);
        }
    }

    animate();
}

// QVQ^(-1) Animation
function animateQVQ() {
    if (realQuaternionMode) {
        animateRealQVQ();
    } else {
        animatePseudoQVQ();
    }
}

// Real Quaternion QVQ^(-1) Animation
function animateRealQVQ() {
    isAnimating = true;
    animationProgress = 0;

    console.log('=== Real Quaternion QVQ^(-1) 연산 시작 ===');
    console.log('Step 1: Q * V = QV (동시에 1 * V = V) - 스케일 변화로 색상 변함');
    console.log('Step 2: QV * Q^(-1) = Final (동시에 1 * Q^(-1) = Q^(-1)) - 방향만 변화, 색상 유지');

    const result = calculateRealQVQResult();

    console.log('V:', result.V.toString(), '-> visual:', result.vPos);
    console.log('QV:', result.QV.toString(), '-> visual:', result.qvPos);
    console.log('Final:', result.QVQInv.toString(), '-> visual:', result.finalPos);

    // Positions
    const identityPos = new THREE.Vector3(0, 0, 1); // (1, 0, 0, 0) -> visual (0, 0, 1)
    const qPos = result.qPos.clone();
    const vPos = result.vPos.clone();
    const qInvPos = result.qInvPos.clone();
    const qvPos = result.qvPos.clone();
    const finalPos = result.finalPos.clone();

    // Colors for interpolation (only for first phase - scale change)
    const colorIdentityStart = new THREE.Color(0xaaaaaa); // gray
    const colorIdentityEnd = new THREE.Color(0xffff00);   // yellow (V's color)
    const colorQStart = new THREE.Color(0x00ffff);        // cyan (Q's color)
    const colorQEnd = new THREE.Color(0xff6600);          // orange (QV's color)

    // Create QV visualization (Q -> QV) - starts cyan, ends orange
    if (objects.transformedQ) scene.remove(objects.transformedQ);
    objects.transformedQ = new THREE.Group();
    const qvSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorQStart.clone() })
    );
    const qvLineGeometry = new THREE.BufferGeometry();
    const qvPositions = new Float32Array(6);
    qvLineGeometry.setAttribute('position', new THREE.BufferAttribute(qvPositions, 3));
    const qvLine = new THREE.Line(
        qvLineGeometry,
        new THREE.LineBasicMaterial({ color: colorQStart.clone(), linewidth: 3 })
    );
    objects.transformedQ.add(qvSphere);
    objects.transformedQ.add(qvLine);
    objects.transformedQ.visible = false;
    scene.add(objects.transformedQ);

    // Create final result visualization - same color as QV (orange) since no scale change
    if (objects.finalResult) scene.remove(objects.finalResult);
    objects.finalResult = new THREE.Group();
    const finalSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorQEnd.clone() })
    );
    const finalLineGeometry = new THREE.BufferGeometry();
    const finalPositions = new Float32Array(6);
    finalLineGeometry.setAttribute('position', new THREE.BufferAttribute(finalPositions, 3));
    const finalLine = new THREE.Line(
        finalLineGeometry,
        new THREE.LineBasicMaterial({ color: colorQEnd.clone(), linewidth: 3 })
    );
    objects.finalResult.add(finalSphere);
    objects.finalResult.add(finalLine);
    objects.finalResult.visible = false;
    scene.add(objects.finalResult);

    // Create transformed identity visualization - starts gray, ends yellow in phase 2
    if (objects.transformedIdentity) scene.remove(objects.transformedIdentity);
    objects.transformedIdentity = new THREE.Group();
    const identitySphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorIdentityStart.clone(), transparent: true, opacity: 0.8 })
    );
    const identityLineGeometry = new THREE.BufferGeometry();
    const identityPositions = new Float32Array(6);
    identityLineGeometry.setAttribute('position', new THREE.BufferAttribute(identityPositions, 3));
    const identityLine = new THREE.Line(
        identityLineGeometry,
        new THREE.LineDashedMaterial({ color: colorIdentityStart.clone(), linewidth: 2, dashSize: 0.1, gapSize: 0.05 })
    );
    objects.transformedIdentity.add(identitySphere);
    objects.transformedIdentity.add(identityLine);
    objects.transformedIdentity.visible = false;
    scene.add(objects.transformedIdentity);

    // Create triangles for transformation visualization
    const origin = new THREE.Vector3(0, 0, 0);
    // Triangle 1: (identity, origin, Q) - for first transformation (QV)
    const triangle1 = createTriangle(identityPos, origin, qPos, 0x00ffff, 0.25);
    scene.add(triangle1);
    // Triangle 2: (V, origin, QV) - for second transformation (×Q^-1)
    const triangle2 = createTriangle(vPos, origin, qvPos, 0xff6600, 0.25);
    triangle2.visible = false;
    scene.add(triangle2);

    const duration = 6000;
    const startTime = Date.now();

    function updateLineGeometry(line, endPos) {
        const posArray = line.geometry.attributes.position.array;
        posArray[0] = 0; posArray[1] = 0; posArray[2] = 0;
        posArray[3] = endPos.x;
        posArray[4] = endPos.y;
        posArray[5] = endPos.z;
        line.geometry.attributes.position.needsUpdate = true;
        if (line.computeLineDistances) line.computeLineDistances();
    }

    function updateColor(group, color) {
        group.children[0].material.color.copy(color);
        group.children[1].material.color.copy(color);
    }

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const easing = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        if (t < 0.2) {
            // Phase 1: Show initial state (1, Q, V, Q^-1) with triangle1
            objects.transformedQ.visible = false;
            objects.finalResult.visible = false;
            objects.transformedIdentity.visible = false;
            triangle1.visible = true;
            triangle2.visible = false;
        } else if (t < 0.45) {
            // Phase 2: Animate Q -> QV and 1 -> V simultaneously (WITH color change - scale changes)
            const phaseT = (t - 0.2) / 0.25;
            const phaseEased = easing(phaseT);

            triangle1.visible = true;
            triangle2.visible = false;

            // Q -> QV with color change (cyan -> orange)
            objects.transformedQ.visible = true;
            const interpolatedQV = new THREE.Vector3();
            interpolatedQV.lerpVectors(qPos, qvPos, phaseEased);
            objects.transformedQ.children[0].position.copy(interpolatedQV);
            updateLineGeometry(objects.transformedQ.children[1], interpolatedQV);
            const currentColorQ = colorQStart.clone().lerp(colorQEnd, phaseEased);
            updateColor(objects.transformedQ, currentColorQ);

            // 1 -> V with color change (gray -> yellow)
            objects.transformedIdentity.visible = true;
            const interpolatedIdentity = new THREE.Vector3();
            interpolatedIdentity.lerpVectors(identityPos, vPos, phaseEased);
            objects.transformedIdentity.children[0].position.copy(interpolatedIdentity);
            updateLineGeometry(objects.transformedIdentity.children[1], interpolatedIdentity);
            const currentColorIdentity = colorIdentityStart.clone().lerp(colorIdentityEnd, phaseEased);
            updateColor(objects.transformedIdentity, currentColorIdentity);

            // Update triangle1: (identity, origin, Q) -> (V, origin, QV)
            updateTriangle(triangle1, interpolatedIdentity, origin, interpolatedQV);
        } else if (t < 0.75) {
            // Phase 3: Animate QV -> Final and 1 -> Q^(-1) (NO color change - only direction changes)
            const phaseT = (t - 0.45) / 0.30;
            const phaseEased = easing(phaseT);

            // Hide triangle1, show and animate triangle2
            triangle1.visible = false;
            triangle2.visible = true;

            // Keep QV visible at final position with final color (orange)
            objects.transformedQ.visible = true;
            objects.transformedQ.children[0].position.copy(qvPos);
            updateLineGeometry(objects.transformedQ.children[1], qvPos);
            updateColor(objects.transformedQ, colorQEnd);

            // QV -> Final - color stays orange (no scale change)
            objects.finalResult.visible = true;
            const interpolatedFinal = new THREE.Vector3();
            interpolatedFinal.lerpVectors(qvPos, finalPos, phaseEased);
            objects.finalResult.children[0].position.copy(interpolatedFinal);
            updateLineGeometry(objects.finalResult.children[1], interpolatedFinal);
            // Color stays orange - no change

            // 1 -> Q^(-1) - color stays yellow (no scale change, only direction)
            objects.transformedIdentity.visible = true;
            const interpolatedIdentity2 = new THREE.Vector3();
            interpolatedIdentity2.lerpVectors(vPos, qInvPos, phaseEased);
            objects.transformedIdentity.children[0].position.copy(interpolatedIdentity2);
            updateLineGeometry(objects.transformedIdentity.children[1], interpolatedIdentity2);
            // Keep yellow color - no change (only direction changes, not scale)
            updateColor(objects.transformedIdentity, colorIdentityEnd);

            // Update triangle2: (V, origin, QV) -> (Q^-1, origin, Final)
            updateTriangle(triangle2, interpolatedIdentity2, origin, interpolatedFinal);
        } else {
            // Phase 4: Show final result
            objects.transformedQ.visible = false;
            objects.finalResult.visible = true;
            objects.finalResult.children[0].position.copy(finalPos);
            updateLineGeometry(objects.finalResult.children[1], finalPos);

            // Show identity at Q^-1 position with yellow color
            objects.transformedIdentity.visible = true;
            objects.transformedIdentity.children[0].position.copy(qInvPos);
            updateLineGeometry(objects.transformedIdentity.children[1], qInvPos);
            updateColor(objects.transformedIdentity, colorIdentityEnd);

            // Show final triangle2 at (Q^-1, origin, Final)
            triangle1.visible = false;
            triangle2.visible = true;
            updateTriangle(triangle2, qInvPos, origin, finalPos);
        }

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            // Clean up triangles
            scene.remove(triangle1);
            scene.remove(triangle2);
            console.log('Real QVQ^(-1) animation complete');
            console.log('Final position:', result.QVQInv.toString());
            console.log('Final visual position:', finalPos);
        }
    }

    animate();
}

// Pseudo-Quaternion QVQ^(-1) Animation
function animatePseudoQVQ() {
    isAnimating = true;
    animationProgress = 0;

    console.log('Animating QVQ^(-1) operation...');
    console.log('Step 1: QV 연산으로 _Q 얻기');
    console.log('Step 2: 단위 z축 벡터와 _Q가 있는 좌표계');
    console.log('Step 3: 단위 z축을 Q^(-1) 위치로 이동하도록 좌표계 변환');
    console.log('Step 4: 변환된 _Q 위치 확인 (최종 결과)');

    // First transformation: z-axis to V
    const transformMatrix1 = calculateTransformationMatrix(params.vx, params.vy);

    // Get Q position
    const thetaRad = (params.theta * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);
    const dLength = Math.sqrt(params.dx * params.dx + params.dy * params.dy);
    const nx = params.dx / dLength;
    const ny = params.dy / dLength;
    const qPos = new THREE.Vector3(
        sinTheta * nx,
        sinTheta * ny,
        cosTheta
    );

    // Q^(-1) position (pseudo-conjugate: cos(θ)·ẑ - sin(θ)·D)
    const qInvPos = new THREE.Vector3(
        -sinTheta * nx,
        -sinTheta * ny,
        cosTheta
    );

    // Transformed Q after QV
    const transformedQPos = applyTransformation(qPos, transformMatrix1);

    // Second transformation: NEW z-axis to Q^(-1) in 3D space
    const transformMatrix2 = calculateTransformationMatrix3D(qInvPos);

    // Final result: apply second transformation to _Q
    const finalPos = applyTransformation(transformedQPos, transformMatrix2);

    console.log('=== QVQ^(-1) 연산 검증 ===');
    console.log('V:', params.vx, params.vy, 0);
    console.log('Q:', qPos);
    console.log('Q^(-1):', qInvPos);

    // Verify first transformation: z-axis should map to V
    const zAxis = new THREE.Vector3(0, 0, 1);
    const verifyV = applyTransformation(zAxis, transformMatrix1);
    console.log('\n[검증 1-1] z축을 V로 변환:');
    console.log('  z축 (0, 0, 1) → V:', verifyV);
    console.log('  예상 V:', params.vx, params.vy, 0);
    console.log('  일치?', Math.abs(verifyV.x - params.vx) < 0.001 && Math.abs(verifyV.y - params.vy) < 0.001 && Math.abs(verifyV.z) < 0.001);

    console.log('\n[검증 1-2] 첫 번째 변환의 각도와 스케일:');
    const vVec = new THREE.Vector3(params.vx, params.vy, 0);
    const angleZtoV = Math.acos(zAxis.dot(vVec.clone().normalize())) * (180 / Math.PI);
    const scaleZtoV = vVec.length() / zAxis.length();
    console.log('  z → V 각도:', angleZtoV.toFixed(2), '°');
    console.log('  z → V 스케일:', scaleZtoV.toFixed(3));

    const angleQtoQT = Math.acos(
        qPos.clone().normalize().dot(transformedQPos.clone().normalize())
    ) * (180 / Math.PI);
    const scaleQtoQT = transformedQPos.length() / qPos.length();
    console.log('  Q → _Q 각도:', angleQtoQT.toFixed(2), '°');
    console.log('  Q → _Q 스케일:', scaleQtoQT.toFixed(3));
    console.log('  각도 일치?', Math.abs(angleZtoV - angleQtoQT) < 0.1);
    console.log('  스케일 일치?', Math.abs(scaleZtoV - scaleQtoQT) < 0.001);

    console.log('\n[검증 2] Q를 같은 변환으로:');
    console.log('  Q:', qPos);
    console.log('  _Q:', transformedQPos);

    // Verify second transformation: z-axis should map to Q^(-1)
    const verifyQInv = applyTransformation(zAxis, transformMatrix2);
    console.log('\n[검증 3-1] z축을 Q^(-1)로 변환:');
    console.log('  z축 (0, 0, 1) → Q^(-1):', verifyQInv);
    console.log('  예상 Q^(-1):', qInvPos);
    console.log('  일치?', verifyQInv.distanceTo(qInvPos) < 0.001);

    console.log('\n[검증 3-2] 두 번째 변환의 각도와 스케일:');
    const angleZtoQInv = Math.acos(zAxis.dot(qInvPos.clone().normalize())) * (180 / Math.PI);
    const scaleZtoQInv = qInvPos.length() / zAxis.length();
    console.log('  z → Q^(-1) 각도:', angleZtoQInv.toFixed(2), '°');
    console.log('  z → Q^(-1) 스케일:', scaleZtoQInv.toFixed(3));

    const angleQTtoFinal = Math.acos(
        transformedQPos.clone().normalize().dot(finalPos.clone().normalize())
    ) * (180 / Math.PI);
    const scaleQTtoFinal = finalPos.length() / transformedQPos.length();
    console.log('  _Q → 최종 각도:', angleQTtoFinal.toFixed(2), '°');
    console.log('  _Q → 최종 스케일:', scaleQTtoFinal.toFixed(3));
    console.log('  각도 일치?', Math.abs(angleZtoQInv - angleQTtoFinal) < 0.1);
    console.log('  스케일 일치?', Math.abs(scaleZtoQInv - scaleQTtoFinal) < 0.001);

    console.log('\n[검증 4] _Q를 같은 변환으로:');
    console.log('  _Q:', transformedQPos);
    console.log('  최종 결과:', finalPos);
    console.log('  최종 z 좌표:', finalPos.z);

    // Create Q^(-1) visualization for animation
    const qInvGroup = new THREE.Group();
    const qInvSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xff00aa })
    );
    qInvSphere.position.copy(qInvPos);
    const qInvLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            qInvPos
        ]),
        new THREE.LineBasicMaterial({ color: 0xff00aa, linewidth: 3 })
    );
    qInvGroup.add(qInvSphere);
    qInvGroup.add(qInvLine);
    scene.add(qInvGroup);

    // Create _Q projection visualization
    const transformedQProjectionGroup = createProjectionPoint(
        transformedQPos.x,
        transformedQPos.y,
        transformedQPos.z,
        0xff6600
    );
    transformedQProjectionGroup.visible = false;
    scene.add(transformedQProjectionGroup);

    // Create second z-axis visualization (the "new" z-axis that will be transformed)
    const newZAxisGroup = createZAxisVector();
    newZAxisGroup.visible = false;
    scene.add(newZAxisGroup);

    // Create visualization objects
    if (objects.transformedAxes) scene.remove(objects.transformedAxes);
    objects.transformedAxes = createCoordinateAxes(1, 0.7);
    objects.transformedAxes.visible = false;
    scene.add(objects.transformedAxes);

    if (objects.transformedAxes2) scene.remove(objects.transformedAxes2);
    objects.transformedAxes2 = createCoordinateAxes(1, 0.5);
    objects.transformedAxes2.visible = false;
    scene.add(objects.transformedAxes2);

    // Colors for interpolation
    const colorQStart = new THREE.Color(0x00ffff);        // cyan (Q's color)
    const colorQEnd = new THREE.Color(0xff6600);          // orange (_Q's color)
    const colorIdentityStart = new THREE.Color(0x00ff00); // green (z-axis color)
    const colorIdentityEnd = new THREE.Color(0xffff00);   // yellow (V's color)

    if (objects.transformedQ) scene.remove(objects.transformedQ);
    objects.transformedQ = new THREE.Group();
    const transformedSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorQStart.clone() })
    );
    const transformedLineGeom = new THREE.BufferGeometry();
    const transformedLinePos = new Float32Array(6);
    transformedLineGeom.setAttribute('position', new THREE.BufferAttribute(transformedLinePos, 3));
    const transformedLine = new THREE.Line(
        transformedLineGeom,
        new THREE.LineBasicMaterial({ color: colorQStart.clone(), linewidth: 3 })
    );
    objects.transformedQ.add(transformedSphere);
    objects.transformedQ.add(transformedLine);
    objects.transformedQ.visible = false;
    scene.add(objects.transformedQ);

    // Final result uses same color as _Q (orange) since no scale change in phase 3
    if (objects.finalResult) scene.remove(objects.finalResult);
    objects.finalResult = new THREE.Group();
    const finalSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorQEnd.clone() })
    );
    const finalLineGeom = new THREE.BufferGeometry();
    const finalLinePos = new Float32Array(6);
    finalLineGeom.setAttribute('position', new THREE.BufferAttribute(finalLinePos, 3));
    const finalLine = new THREE.Line(
        finalLineGeom,
        new THREE.LineBasicMaterial({ color: colorQEnd.clone(), linewidth: 3 })
    );
    objects.finalResult.add(finalSphere);
    objects.finalResult.add(finalLine);
    objects.finalResult.visible = false;
    scene.add(objects.finalResult);

    // Create transformed identity (z-axis -> V) visualization
    if (objects.transformedIdentity) scene.remove(objects.transformedIdentity);
    objects.transformedIdentity = new THREE.Group();
    const identitySphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorIdentityStart.clone(), transparent: true, opacity: 0.8 })
    );
    const identityLineGeom = new THREE.BufferGeometry();
    const identityLinePos = new Float32Array(6);
    identityLineGeom.setAttribute('position', new THREE.BufferAttribute(identityLinePos, 3));
    const identityLine = new THREE.Line(
        identityLineGeom,
        new THREE.LineDashedMaterial({ color: colorIdentityStart.clone(), linewidth: 2, dashSize: 0.1, gapSize: 0.05 })
    );
    objects.transformedIdentity.add(identitySphere);
    objects.transformedIdentity.add(identityLine);
    objects.transformedIdentity.visible = false;
    scene.add(objects.transformedIdentity);

    // V position for identity transformation target
    const vPos = new THREE.Vector3(params.vx, params.vy, 0);

    // Create triangles for transformation visualization
    const origin = new THREE.Vector3(0, 0, 0);
    // Triangle 1: (identity/z-axis, origin, Q) - for first transformation (QV)
    const triangle1 = createTriangle(zAxis, origin, qPos, 0x00ffff, 0.25);
    scene.add(triangle1);
    // Triangle 2: (V, origin, _Q) - for second transformation (×Q^-1)
    const triangle2 = createTriangle(vPos, origin, transformedQPos, 0xff6600, 0.25);
    triangle2.visible = false;
    scene.add(triangle2);

    const duration = 6000; // 6 seconds
    const startTime = Date.now();

    function updateLineGeometryPseudo(lineObj, endPos) {
        const posArray = lineObj.geometry.attributes.position.array;
        posArray[0] = 0; posArray[1] = 0; posArray[2] = 0;
        posArray[3] = endPos.x;
        posArray[4] = endPos.y;
        posArray[5] = endPos.z;
        lineObj.geometry.attributes.position.needsUpdate = true;
        if (lineObj.computeLineDistances) lineObj.computeLineDistances();
    }

    function updateColorPseudo(group, color) {
        group.children[0].material.color.copy(color);
        group.children[1].material.color.copy(color);
    }

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        animationProgress = t;

        const easing = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        if (t < 0.25) {
            // Phase 1: Initial state - show original z-axis, Q, Q^(-1), V with triangle1
            console.log('Phase 1: 초기 상태');
            objects.transformedAxes.visible = false;
            objects.transformedAxes2.visible = false;
            objects.transformedQ.visible = false;
            objects.finalResult.visible = false;
            newZAxisGroup.visible = false;
            qInvGroup.visible = true;
            transformedQProjectionGroup.visible = false;
            triangle1.visible = true;
            triangle2.visible = false;
        } else if (t < 0.5) {
            // Phase 2: First transformation (z → V), show _Q (WITH color change - scale changes)
            const phaseT = (t - 0.25) / 0.25;
            const phaseEased = easing(phaseT);

            if (phaseT === 0) console.log('Phase 2: 첫 번째 변환 (z → V) - 스케일 변화로 색상 변함');

            objects.transformedAxes.visible = true;
            objects.transformedAxes2.visible = false;
            objects.transformedQ.visible = true;
            objects.finalResult.visible = false;
            newZAxisGroup.visible = false;
            qInvGroup.visible = true;
            transformedQProjectionGroup.visible = true;
            objects.transformedIdentity.visible = true;

            // Decompose first transformation matrix
            const targetPos1 = new THREE.Vector3();
            const targetQuat1 = new THREE.Quaternion();
            const targetScale1 = new THREE.Vector3();
            transformMatrix1.decompose(targetPos1, targetQuat1, targetScale1);

            // Interpolate
            const currentPos = new THREE.Vector3(0, 0, 0);
            currentPos.lerp(targetPos1, phaseEased);

            const identityQuat = new THREE.Quaternion();
            const currentQuat = new THREE.Quaternion();
            currentQuat.slerpQuaternions(identityQuat, targetQuat1, phaseEased);

            const currentScale = new THREE.Vector3(1, 1, 1);
            currentScale.lerp(targetScale1, phaseEased);

            objects.transformedAxes.position.copy(currentPos);
            objects.transformedAxes.quaternion.copy(currentQuat);
            objects.transformedAxes.scale.copy(currentScale);

            // Show _Q transformation with color change (cyan -> orange)
            const interpolatedQPos = new THREE.Vector3();
            interpolatedQPos.lerpVectors(qPos, transformedQPos, phaseEased);
            objects.transformedQ.children[0].position.copy(interpolatedQPos);
            updateLineGeometryPseudo(objects.transformedQ.children[1], interpolatedQPos);
            const currentColorQ = colorQStart.clone().lerp(colorQEnd, phaseEased);
            updateColorPseudo(objects.transformedQ, currentColorQ);

            // Transform identity (z-axis -> V) with color change (green -> yellow)
            const interpolatedIdentityPos = new THREE.Vector3();
            interpolatedIdentityPos.lerpVectors(zAxis, vPos, phaseEased);
            objects.transformedIdentity.children[0].position.copy(interpolatedIdentityPos);
            updateLineGeometryPseudo(objects.transformedIdentity.children[1], interpolatedIdentityPos);
            const currentColorIdentity = colorIdentityStart.clone().lerp(colorIdentityEnd, phaseEased);
            updateColorPseudo(objects.transformedIdentity, currentColorIdentity);

            // Update triangle1: (identity, origin, Q) -> (V, origin, _Q)
            triangle1.visible = true;
            triangle2.visible = false;
            updateTriangle(triangle1, interpolatedIdentityPos, origin, interpolatedQPos);
        } else if (t < 0.75) {
            // Phase 3: Second transformation (NEW z → Q^(-1)) - NO color change, only direction
            const phaseT = (t - 0.5) / 0.25;
            const phaseEased = easing(phaseT);

            if (phaseT < 0.01) console.log('Phase 3: 두 번째 변환 (새로운 z → Q^(-1)) - 방향만 변화, 색상 유지');

            // Keep first transformation visible but faded
            objects.transformedAxes.visible = true;
            objects.transformedAxes2.visible = true;
            objects.transformedQ.visible = true;
            objects.finalResult.visible = true;
            newZAxisGroup.visible = true;
            qInvGroup.visible = true;
            transformedQProjectionGroup.visible = true;
            objects.transformedIdentity.visible = true;

            // First transformation (faded)
            const pos1 = new THREE.Vector3();
            const quat1 = new THREE.Quaternion();
            const scale1 = new THREE.Vector3();
            transformMatrix1.decompose(pos1, quat1, scale1);
            objects.transformedAxes.position.copy(pos1);
            objects.transformedAxes.quaternion.copy(quat1);
            objects.transformedAxes.scale.copy(scale1);

            // Keep _Q at final position with orange color (no change)
            objects.transformedQ.children[0].position.copy(transformedQPos);
            updateLineGeometryPseudo(objects.transformedQ.children[1], transformedQPos);
            updateColorPseudo(objects.transformedQ, colorQEnd);

            // Animate second transformation
            const identityPos2 = new THREE.Vector3(0, 0, 0);
            const identityQuat2 = new THREE.Quaternion();
            const identityScale2 = new THREE.Vector3(1, 1, 1);

            const targetPos2 = new THREE.Vector3();
            const targetQuat2 = new THREE.Quaternion();
            const targetScale2 = new THREE.Vector3();
            transformMatrix2.decompose(targetPos2, targetQuat2, targetScale2);

            const currentPos2 = new THREE.Vector3();
            currentPos2.lerpVectors(identityPos2, targetPos2, phaseEased);

            const currentQuat2 = new THREE.Quaternion();
            currentQuat2.slerpQuaternions(identityQuat2, targetQuat2, phaseEased);

            const currentScale2 = new THREE.Vector3();
            currentScale2.lerpVectors(identityScale2, targetScale2, phaseEased);

            objects.transformedAxes2.position.copy(currentPos2);
            objects.transformedAxes2.quaternion.copy(currentQuat2);
            objects.transformedAxes2.scale.copy(currentScale2);

            // Animate new z-axis transformation - lerp from (0,0,1) to Q^(-1)
            const originalZ = new THREE.Vector3(0, 0, 1);
            const targetZ = qInvPos.clone();
            const currentZ = new THREE.Vector3();
            currentZ.lerpVectors(originalZ, targetZ, phaseEased);

            // Update the z-axis visual to point to currentZ
            newZAxisGroup.position.set(0, 0, 0);
            newZAxisGroup.rotation.set(0, 0, 0);
            newZAxisGroup.scale.set(1, 1, 1);

            // Scale the group to match current transformation
            const scaleAmount = currentZ.length();
            if (scaleAmount > 0.01) {
                const direction = currentZ.clone().normalize();
                const up = new THREE.Vector3(0, 0, 1);
                const quat = new THREE.Quaternion();
                quat.setFromUnitVectors(up, direction);
                newZAxisGroup.quaternion.copy(quat);
                newZAxisGroup.scale.set(scaleAmount, scaleAmount, scaleAmount);
            }

            // Show final result transformation (_Q -> Final) - color stays orange
            const interpolatedFinalPos = new THREE.Vector3();
            interpolatedFinalPos.lerpVectors(transformedQPos, finalPos, phaseEased);
            objects.finalResult.children[0].position.copy(interpolatedFinalPos);
            updateLineGeometryPseudo(objects.finalResult.children[1], interpolatedFinalPos);
            // Color stays orange - no scale change, only direction

            // Animate identity (V -> Q^(-1)) - color stays yellow (no scale change)
            const interpolatedIdentityPos2 = new THREE.Vector3();
            interpolatedIdentityPos2.lerpVectors(vPos, qInvPos, phaseEased);
            objects.transformedIdentity.children[0].position.copy(interpolatedIdentityPos2);
            updateLineGeometryPseudo(objects.transformedIdentity.children[1], interpolatedIdentityPos2);
            updateColorPseudo(objects.transformedIdentity, colorIdentityEnd); // Keep yellow

            // Update triangles: hide triangle1, show and animate triangle2
            triangle1.visible = false;
            triangle2.visible = true;
            // Triangle2: (V, origin, _Q) -> (Q^-1, origin, Final)
            updateTriangle(triangle2, interpolatedIdentityPos2, origin, interpolatedFinalPos);
        } else {
            // Phase 4: Show final result
            console.log('Phase 4: 최종 결과');
            objects.transformedAxes.visible = false; // Hide first transformation
            objects.transformedAxes2.visible = true;
            objects.transformedQ.visible = false; // Hide intermediate _Q
            objects.finalResult.visible = true;
            newZAxisGroup.visible = false;
            qInvGroup.visible = true;
            transformedQProjectionGroup.visible = false; // Hide projection in final phase
            objects.transformedIdentity.visible = true;

            // Show final triangle2 at (Q^-1, origin, Final)
            triangle1.visible = false;
            triangle2.visible = true;
            updateTriangle(triangle2, qInvPos, origin, finalPos);

            // Show final coordinate system
            const pos2 = new THREE.Vector3();
            const quat2 = new THREE.Quaternion();
            const scale2 = new THREE.Vector3();
            transformMatrix2.decompose(pos2, quat2, scale2);
            objects.transformedAxes2.position.copy(pos2);
            objects.transformedAxes2.quaternion.copy(quat2);
            objects.transformedAxes2.scale.copy(scale2);

            // Show final result position (orange)
            objects.finalResult.children[0].position.copy(finalPos);
            updateLineGeometryPseudo(objects.finalResult.children[1], finalPos);

            // Show identity at Q^(-1) position with yellow color
            objects.transformedIdentity.children[0].position.copy(qInvPos);
            updateLineGeometryPseudo(objects.transformedIdentity.children[1], qInvPos);
            updateColorPseudo(objects.transformedIdentity, colorIdentityEnd); // Keep yellow
        }

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            // Clean up animation-specific objects
            scene.remove(qInvGroup);
            scene.remove(newZAxisGroup);
            scene.remove(transformedQProjectionGroup);
            scene.remove(triangle1);
            scene.remove(triangle2);
            console.log('QVQ^(-1) animation complete');
            console.log('Final position:', finalPos);
        }
    }

    animate();
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize
initObjects();
updateAngleDisplay();
animate();