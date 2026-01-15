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
    // Coordinate system axes
    coordinateAxes: null,
    // Transformed coordinate system
    transformedAxes: null,
    // Second coordinate system (for QVQ^-1)
    transformedAxes2: null
};

// State
let showFinalResult = false;

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

        console.log('Angles updated:', angleQtoQT.toFixed(2), angleQtoFinal.toFixed(2), angleQTtoFinal.toFixed(2));
    } catch (error) {
        console.error('Error updating angles:', error);
    }
}

// Calculate QVQ^(-1) result
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

    // Create transformed Q
    if (objects.transformedQ) scene.remove(objects.transformedQ);
    const transformedQGroup = new THREE.Group();
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xff6600 })
    );
    sphere.position.copy(transformedQPos);
    const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            transformedQPos
        ]),
        new THREE.LineBasicMaterial({ color: 0xff6600, linewidth: 3 })
    );
    transformedQGroup.add(sphere);
    transformedQGroup.add(line);
    transformedQGroup.visible = false;
    scene.add(transformedQGroup);
    objects.transformedQ = transformedQGroup;

    console.log('Q:', qPos);
    console.log('_Q (변환 후):', transformedQPos);

    const duration = 3000; // 3 seconds
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        animationProgress = t;

        // Easing function (smooth in-out)
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        if (t < 0.33) {
            // Phase 1: Show initial state
            console.log('Phase 1: 초기 상태 - z축과 Q');
            objects.transformedAxes.visible = false;
            objects.transformedQ.visible = false;
        } else if (t < 0.67) {
            // Phase 2: Transform coordinate system
            const phaseT = (t - 0.33) / 0.34;
            const phaseEased = phaseT < 0.5 ? 2 * phaseT * phaseT : 1 - Math.pow(-2 * phaseT + 2, 2) / 2;

            objects.transformedAxes.visible = true;

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

            // Transform Q
            const interpolatedQPos = new THREE.Vector3();
            interpolatedQPos.lerpVectors(qPos, transformedQPos, phaseEased);
            transformedQGroup.children[0].position.copy(interpolatedQPos);
            transformedQGroup.children[1].geometry.setFromPoints([
                new THREE.Vector3(0, 0, 0),
                interpolatedQPos
            ]);
            objects.transformedQ.visible = true;
        } else {
            // Phase 3: Show final result
            objects.transformedAxes.visible = true;
            objects.transformedQ.visible = true;
        }

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            console.log('QV animation complete');
            console.log('Transformed Q position:', transformedQPos);
        }
    }

    animate();
}

// QVQ^(-1) Animation
function animateQVQ() {
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

    if (objects.transformedQ) scene.remove(objects.transformedQ);
    objects.transformedQ = new THREE.Group();
    const transformedSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xff6600 })
    );
    const transformedLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xff6600, linewidth: 3 })
    );
    objects.transformedQ.add(transformedSphere);
    objects.transformedQ.add(transformedLine);
    objects.transformedQ.visible = false;
    scene.add(objects.transformedQ);

    if (objects.finalResult) scene.remove(objects.finalResult);
    objects.finalResult = new THREE.Group();
    const finalSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0x00ff00 })
    );
    const finalLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
    );
    objects.finalResult.add(finalSphere);
    objects.finalResult.add(finalLine);
    objects.finalResult.visible = false;
    scene.add(objects.finalResult);

    const duration = 6000; // 6 seconds
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        animationProgress = t;

        const easing = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        if (t < 0.25) {
            // Phase 1: Initial state - show original z-axis, Q, Q^(-1), V
            console.log('Phase 1: 초기 상태');
            objects.transformedAxes.visible = false;
            objects.transformedAxes2.visible = false;
            objects.transformedQ.visible = false;
            objects.finalResult.visible = false;
            newZAxisGroup.visible = false;
            qInvGroup.visible = true;
            transformedQProjectionGroup.visible = false;
        } else if (t < 0.5) {
            // Phase 2: First transformation (z → V), show _Q
            const phaseT = (t - 0.25) / 0.25;
            const phaseEased = easing(phaseT);

            if (phaseT === 0) console.log('Phase 2: 첫 번째 변환 (z → V)');

            objects.transformedAxes.visible = true;
            objects.transformedAxes2.visible = false;
            objects.transformedQ.visible = true;
            objects.finalResult.visible = false;
            newZAxisGroup.visible = false;
            qInvGroup.visible = true;
            transformedQProjectionGroup.visible = true;

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

            // Show _Q transformation
            const interpolatedQPos = new THREE.Vector3();
            interpolatedQPos.lerpVectors(qPos, transformedQPos, phaseEased);
            objects.transformedQ.children[0].position.copy(interpolatedQPos);
            objects.transformedQ.children[1].geometry.setFromPoints([
                new THREE.Vector3(0, 0, 0),
                interpolatedQPos
            ]);
        } else if (t < 0.75) {
            // Phase 3: Second transformation (NEW z → Q^(-1))
            const phaseT = (t - 0.5) / 0.25;
            const phaseEased = easing(phaseT);

            if (phaseT < 0.01) console.log('Phase 3: 두 번째 변환 (새로운 z → Q^(-1))');

            // Keep first transformation visible but faded
            objects.transformedAxes.visible = true;
            objects.transformedAxes2.visible = true;
            objects.transformedQ.visible = true;
            objects.finalResult.visible = true;
            newZAxisGroup.visible = true;
            qInvGroup.visible = true;
            transformedQProjectionGroup.visible = true;

            // First transformation (faded)
            const pos1 = new THREE.Vector3();
            const quat1 = new THREE.Quaternion();
            const scale1 = new THREE.Vector3();
            transformMatrix1.decompose(pos1, quat1, scale1);
            objects.transformedAxes.position.copy(pos1);
            objects.transformedAxes.quaternion.copy(quat1);
            objects.transformedAxes.scale.copy(scale1);

            // Animate second transformation
            const identityPos = new THREE.Vector3(0, 0, 0);
            const identityQuat = new THREE.Quaternion();
            const identityScale = new THREE.Vector3(1, 1, 1);

            const targetPos2 = new THREE.Vector3();
            const targetQuat2 = new THREE.Quaternion();
            const targetScale2 = new THREE.Vector3();
            transformMatrix2.decompose(targetPos2, targetQuat2, targetScale2);

            const currentPos2 = new THREE.Vector3();
            currentPos2.lerpVectors(identityPos, targetPos2, phaseEased);

            const currentQuat2 = new THREE.Quaternion();
            currentQuat2.slerpQuaternions(identityQuat, targetQuat2, phaseEased);

            const currentScale2 = new THREE.Vector3();
            currentScale2.lerpVectors(identityScale, targetScale2, phaseEased);

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

            // Show final result transformation
            const interpolatedFinalPos = new THREE.Vector3();
            interpolatedFinalPos.lerpVectors(transformedQPos, finalPos, phaseEased);
            objects.finalResult.children[0].position.copy(interpolatedFinalPos);
            objects.finalResult.children[1].geometry.setFromPoints([
                new THREE.Vector3(0, 0, 0),
                interpolatedFinalPos
            ]);
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

            // Show final coordinate system
            const pos2 = new THREE.Vector3();
            const quat2 = new THREE.Quaternion();
            const scale2 = new THREE.Vector3();
            transformMatrix2.decompose(pos2, quat2, scale2);
            objects.transformedAxes2.position.copy(pos2);
            objects.transformedAxes2.quaternion.copy(quat2);
            objects.transformedAxes2.scale.copy(scale2);

            // Show final result position
            objects.finalResult.children[0].position.copy(finalPos);
            objects.finalResult.children[1].geometry.setFromPoints([
                new THREE.Vector3(0, 0, 0),
                finalPos
            ]);
        }

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            // Clean up animation-specific objects
            scene.remove(qInvGroup);
            scene.remove(newZAxisGroup);
            scene.remove(transformedQProjectionGroup);
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