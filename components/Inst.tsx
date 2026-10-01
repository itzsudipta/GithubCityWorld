"use client";

import * as THREE from 'three';
import { forwardRef, useLayoutEffect, useImperativeHandle, useRef } from 'react';

const _o = new THREE.Object3D();
export function M(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) {
  _o.position.set(x, y, z); _o.scale.set(sx, sy, sz); _o.rotation.set(0, ry, 0); _o.updateMatrix();
  return _o.matrix.clone();
}

interface Props {
  geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[];
  colors?: THREE.Color[]; shadow?: boolean; receive?: boolean;
}

const Inst = forwardRef<THREE.InstancedMesh, Props>(function Inst({ geometry, material, matrices, colors, shadow, receive }, fwd) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useImperativeHandle(fwd, () => ref.current);
  useLayoutEffect(() => {
    const m = ref.current;
    matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
    colors?.forEach((c, i) => m.setColorAt(i, c));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [matrices, colors]);
  if (!matrices.length) return null;
  return <instancedMesh key={matrices.length} ref={ref} args={[geometry, material, matrices.length]} castShadow={shadow} receiveShadow={receive} frustumCulled={false} />;
});
export default Inst;
