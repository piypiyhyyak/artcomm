/* eslint-disable react/no-unknown-property */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

// replace with your own imports, see the usage snippet for details
import cardGLB from './card.glb';
import lanyard from './lanyard.png';

import * as THREE from 'three';
import './Lanyard.css';

extend({ MeshLineGeometry, MeshLineMaterial });

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, w, h) {
  if (!img || !img.width || !img.height) {
    return;
  }
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

export default function Lanyard({ position = [0, 0, 30], gravity = [0, -40, 0], fov = 20, transparent = true }) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="lanyard-wrapper">
      <Canvas
        camera={{ position: position, fov: fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band isMobile={isMobile} />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer
            intensity={2}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}
function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false }) {
  const band = useRef(),
    fixed = useRef(),
    j1 = useRef(),
    j2 = useRef(),
    j3 = useRef(),
    card = useRef();
  const releasedAtRef = useRef(0);
  const vec = new THREE.Vector3(),
    ang = new THREE.Vector3(),
    rot = new THREE.Vector3(),
    dir = new THREE.Vector3();
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 };
  const { nodes, materials } = useGLTF(cardGLB);
  const texture = useTexture(lanyard);
  const logoTexture = useTexture('/assets/logo-mark.png');
  const frontPhotoTexture = useTexture('/assets/expert-1.png');
  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
  );
  const [dragged, drag] = useState(false);
  const [hovered, hover] = useState(false);

  const strapTexture = useMemo(() => {
    if (!logoTexture?.image || !logoTexture.image.width || !logoTexture.image.height || typeof document === 'undefined') {
      return texture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return texture;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = logoTexture.image;
    const markHeight = 148;
    const markWidth = Math.max(1, Math.round((img.width / img.height) * markHeight));
    const y = Math.round((canvas.height - markHeight) / 2);
    const xPositions = [256, 512, 768];

    try {
      xPositions.forEach(x => {
        const stamp = document.createElement('canvas');
        stamp.width = markWidth;
        stamp.height = markHeight;
        const stampCtx = stamp.getContext('2d');
        if (!stampCtx) {
          return;
        }
        stampCtx.drawImage(img, 0, 0, markWidth, markHeight);
        stampCtx.globalCompositeOperation = 'source-atop';
        stampCtx.fillStyle = '#ffffff';
        stampCtx.fillRect(0, 0, markWidth, markHeight);
        ctx.drawImage(stamp, Math.round(x - markWidth / 2), y);
      });
    } catch {
      return texture;
    }

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.wrapS = THREE.RepeatWrapping;
    nextTexture.wrapT = THREE.RepeatWrapping;
    nextTexture.anisotropy = 8;
    nextTexture.needsUpdate = true;
    if ('colorSpace' in nextTexture) {
      nextTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return nextTexture;
  }, [logoTexture, texture]);

  const frontBadgeTexture = useMemo(() => {
    if (
      !frontPhotoTexture?.image ||
      !frontPhotoTexture.image.width ||
      !frontPhotoTexture.image.height ||
      typeof document === 'undefined'
    ) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1536;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const cardX = 34;
    const cardY = 34;
    const cardW = canvas.width - 68;
    const cardH = canvas.height - 68;
    const photoX = 92;
    const photoY = 96;
    const photoW = canvas.width - 184;
    const photoH = 980;

    roundedRectPath(ctx, cardX, cardY, cardW, cardH, 56);
    ctx.fillStyle = '#f5f6f8';
    ctx.fill();

    ctx.save();
    roundedRectPath(ctx, photoX, photoY, photoW, photoH, 40);
    ctx.clip();
    try {
      drawImageCover(ctx, frontPhotoTexture.image, photoX, photoY, photoW, photoH);
    } catch {
      return null;
    }
    ctx.restore();

    ctx.fillStyle = '#0A2540';
    ctx.font = '700 86px Manrope, sans-serif';
    ctx.fillText('Роман Скудняков', 92, 1210);

    ctx.fillStyle = '#4B6280';
    ctx.font = '500 52px Manrope, sans-serif';
    ctx.fillText('Автор методологии и руководитель', 92, 1290);
    ctx.fillText('проектов института', 92, 1352);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.anisotropy = 8;
    nextTexture.needsUpdate = true;
    if ('colorSpace' in nextTexture) {
      nextTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return nextTexture;
  }, [frontPhotoTexture]);

  const backBadgeTexture = useMemo(() => {
    if (!logoTexture?.image || !logoTexture.image.width || !logoTexture.image.height || typeof document === 'undefined') {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1536;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const cardX = 34;
    const cardY = 34;
    const cardW = canvas.width - 68;
    const cardH = canvas.height - 68;
    roundedRectPath(ctx, cardX, cardY, cardW, cardH, 56);
    ctx.fillStyle = '#f5f6f8';
    ctx.fill();

    const img = logoTexture.image;
    const maxLogoWidth = cardW * 0.62;
    const maxLogoHeight = cardH * 0.62;
    const scale = Math.min(maxLogoWidth / img.width, maxLogoHeight / img.height);
    const markWidth = Math.max(1, Math.round(img.width * scale));
    const markHeight = Math.max(1, Math.round(img.height * scale));
    const x = Math.round((canvas.width - markWidth) / 2);
    const y = Math.round((canvas.height - markHeight) / 2);

    const stamp = document.createElement('canvas');
    stamp.width = markWidth;
    stamp.height = markHeight;
    const stampCtx = stamp.getContext('2d');
    if (stampCtx) {
      try {
        stampCtx.drawImage(img, 0, 0, markWidth, markHeight);
        stampCtx.globalCompositeOperation = 'source-atop';
        stampCtx.fillStyle = '#111111';
        stampCtx.fillRect(0, 0, markWidth, markHeight);
        ctx.drawImage(stamp, x, y);
      } catch {
        return null;
      }
    }

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.anisotropy = 8;
    nextTexture.needsUpdate = true;
    if ('colorSpace' in nextTexture) {
      nextTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return nextTexture;
  }, [logoTexture]);

  const cardFaceSize = useMemo(
    () => ({
      center: new THREE.Vector3(0, 0, 0),
      width: 1.52,
      height: 2.14,
      depthOffset: 0.0135
    }),
    []
  );

  useEffect(() => {
    return () => {
      if (strapTexture !== texture && typeof strapTexture?.dispose === 'function') {
        strapTexture.dispose();
      }
      if (frontBadgeTexture && typeof frontBadgeTexture.dispose === 'function') {
        frontBadgeTexture.dispose();
      }
      if (backBadgeTexture && typeof backBadgeTexture.dispose === 'function') {
        backBadgeTexture.dispose();
      }
    };
  }, [backBadgeTexture, frontBadgeTexture, strapTexture, texture]);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.5, 0]
  ]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => void (document.body.style.cursor = 'auto');
    }
  }, [hovered, dragged]);

  useEffect(() => {
    if (!dragged) return undefined;

    const stopDrag = () => {
      drag(false);
      releasedAtRef.current = performance.now();
      if (card.current) {
        card.current.wakeUp();
      }
    };

    const stopDragOnVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopDrag();
      }
    };

    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    window.addEventListener('blur', stopDrag);
    document.addEventListener('visibilitychange', stopDragOnVisibility);

    return () => {
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
      window.removeEventListener('blur', stopDrag);
      document.removeEventListener('visibilitychange', stopDragOnVisibility);
    };
  }, [dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z });
    }
    if (fixed.current) {
      [j1, j2].forEach(ref => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
        );
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));

      // Keep free flipping shortly after release, then softly return to front.
      if (card.current && !dragged) {
        const msFromRelease = releasedAtRef.current ? performance.now() - releasedAtRef.current : Number.POSITIVE_INFINITY;
        if (msFromRelease < 1800) {
          return;
        }

        const settleGain = msFromRelease > 3200 ? 1.25 : 0.72;
        ang.copy(card.current.angvel());
        rot.copy(card.current.rotation());
        card.current.setAngvel(
          {
            x: ang.x - rot.x * settleGain * 0.72,
            y: ang.y - rot.y * settleGain,
            z: ang.z - rot.z * settleGain * 0.72
          },
          true
        );
      }
    }
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const anchorX = isMobile ? 2.35 : 2.15;
  const anchorY = isMobile ? 4.2 : 4.45;

  return (
    <>
      <group position={[anchorX, anchorY, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={e => {
              e.target.releasePointerCapture(e.pointerId);
              drag(false);
              releasedAtRef.current = performance.now();
              card.current?.wakeUp();
            }}
            onLostPointerCapture={() => {
              if (dragged) {
                drag(false);
                releasedAtRef.current = performance.now();
              }
            }}
            onPointerCancel={() => {
              drag(false);
              releasedAtRef.current = performance.now();
            }}
            onPointerDown={e => {
              e.target.setPointerCapture(e.pointerId);
              releasedAtRef.current = 0;
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                color="#f5f6f8"
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.08}
              />
            </mesh>
            {frontBadgeTexture ? (
              <mesh
                position={[cardFaceSize.center.x, cardFaceSize.center.y, cardFaceSize.center.z + cardFaceSize.depthOffset]}
                renderOrder={10}
              >
                <planeGeometry args={[cardFaceSize.width, cardFaceSize.height]} />
                <meshBasicMaterial map={frontBadgeTexture} transparent alphaTest={0.02} toneMapped={false} side={THREE.FrontSide} />
              </mesh>
            ) : null}
            {backBadgeTexture ? (
              <mesh
                position={[cardFaceSize.center.x, cardFaceSize.center.y, cardFaceSize.center.z - cardFaceSize.depthOffset]}
                rotation={[0, Math.PI, 0]}
                renderOrder={10}
              >
                <planeGeometry args={[cardFaceSize.width, cardFaceSize.height]} />
                <meshBasicMaterial map={backBadgeTexture} transparent alphaTest={0.02} toneMapped={false} side={THREE.FrontSide} />
              </mesh>
            ) : null}
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={strapTexture}
          repeat={[-1.2, 1]}
          lineWidth={0.65}
        />
      </mesh>
    </>
  );
}
