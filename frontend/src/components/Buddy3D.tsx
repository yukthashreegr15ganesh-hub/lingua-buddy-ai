import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CharacterState } from '../types';
import { Volume2, Sparkles, Mic, Brain, HeartHandshake, Smile } from 'lucide-react';

interface Buddy3DProps {
  state: CharacterState;
  speechBubble?: string;
  subText?: string;
  languageName?: string;
  onSelectState?: (state: CharacterState) => void;
  onSpeakGreeting?: () => void;
  compact?: boolean;
}

const STATE_META: Record<
  CharacterState,
  { label: string; badgeBg: string; auraColor: string; description: string }
> = {
  IDLE: {
    label: 'Ready & Breathing',
    badgeBg: 'bg-amber-500/90 text-white',
    auraColor: '#f59e0b',
    description: 'Natural standing & breathing',
  },
  GREETING: {
    label: 'Greeting You!',
    badgeBg: 'bg-orange-500 text-white',
    auraColor: '#f97316',
    description: 'Waving & welcoming you',
  },
  LISTENING: {
    label: 'Listening to You...',
    badgeBg: 'bg-emerald-600 text-white animate-pulse',
    auraColor: '#10b981',
    description: 'Microphone active — attentive posture',
  },
  SPEAKING: {
    label: 'Buddy is Speaking',
    badgeBg: 'bg-sky-600 text-white',
    auraColor: '#0ea5e9',
    description: 'Speaking with rhythmic mouth & hand gestures',
  },
  THINKING: {
    label: 'Thinking...',
    badgeBg: 'bg-violet-600 text-white',
    auraColor: '#8b5cf6',
    description: 'Thoughtful pose while evaluating',
  },
  HAPPY: {
    label: 'Celebrating!',
    badgeBg: 'bg-green-600 text-white',
    auraColor: '#22c55e',
    description: 'Celebrating your great pronunciation!',
  },
  ENCOURAGING: {
    label: 'Encouraging You',
    badgeBg: 'bg-rose-500 text-white',
    auraColor: '#f43f5e',
    description: 'Warmly supporting another attempt',
  },
  CORRECTING: {
    label: 'Gentle Tip',
    badgeBg: 'bg-amber-600 text-white',
    auraColor: '#d97706',
    description: 'Gentle instructional gesture',
  },
  FAREWELL: {
    label: 'See You Soon!',
    badgeBg: 'bg-indigo-600 text-white',
    auraColor: '#6366f1',
    description: 'Waving goodbye after a great session',
  },
};

function ArticulatedBuddyCharacter({ state }: { state: CharacterState }) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);

  useFrame((clockState) => {
    const t = clockState.clock.getElapsedTime();
    if (!rootRef.current || !bodyRef.current || !headRef.current || !leftArmRef.current || !rightArmRef.current) {
      return;
    }

    // Periodic natural eye blink every ~3.6 seconds
    const blinkCycle = t % 3.6;
    const eyeScaleY = blinkCycle > 3.45 ? 0.12 : 1.0;
    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, eyeScaleY, 0.35);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, eyeScaleY, 0.35);
    }

    // Default targets
    let rootY = -0.75 + Math.sin(t * 2.2) * 0.03;
    let rootRotY = Math.sin(t * 0.8) * 0.08;
    let bodyRotX = 0;
    let headRotZ = Math.sin(t * 1.5) * 0.03;
    let headRotX = 0;
    let headRotY = Math.sin(t * 1.1) * 0.06;

    let lArmX = 0;
    let lArmZ = 0.28;
    let rArmX = 0;
    let rArmZ = -0.28;

    let mouthScaleY = 0.35;
    let mouthScaleX = 1.0;

    switch (state) {
      case 'IDLE':
        bodyRef.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.018);
        lArmZ = 0.26 + Math.sin(t * 2) * 0.04;
        rArmZ = -0.26 - Math.sin(t * 2) * 0.04;
        break;

      case 'GREETING':
        rootY = -0.73 + Math.abs(Math.sin(t * 4)) * 0.06;
        rArmZ = -2.45 + Math.sin(t * 9) * 0.32;
        rArmX = -0.2;
        lArmZ = 0.35;
        headRotZ = 0.08;
        mouthScaleX = 1.25;
        mouthScaleY = 0.65;
        break;

      case 'LISTENING':
        bodyRotX = 0.12;
        headRotZ = -0.16;
        headRotX = 0.08;
        rArmZ = -1.65;
        rArmX = -0.55;
        lArmZ = 0.3;
        mouthScaleY = 0.25;
        break;

      case 'SPEAKING':
        rootY = -0.74 + Math.sin(t * 4) * 0.03;
        headRotX = Math.sin(t * 6) * 0.06;
        headRotY = Math.sin(t * 3) * 0.12;
        lArmZ = 0.65 + Math.sin(t * 5) * 0.22;
        lArmX = -0.35;
        rArmZ = -0.65 - Math.cos(t * 5) * 0.22;
        rArmX = -0.35;
        // Honest rhythmic speaking mouth movement
        mouthScaleY = 0.35 + Math.abs(Math.sin(t * 12)) * 1.15;
        mouthScaleX = 0.85 + Math.abs(Math.cos(t * 9)) * 0.35;
        break;

      case 'THINKING':
        headRotZ = 0.18;
        headRotX = -0.14;
        rArmZ = -1.35;
        rArmX = -0.75;
        lArmZ = 0.4;
        mouthScaleX = 0.6;
        mouthScaleY = 0.3;
        break;

      case 'HAPPY':
        rootY = -0.68 + Math.abs(Math.sin(t * 7)) * 0.16;
        rootRotY = Math.sin(t * 4) * 0.22;
        lArmZ = 2.35 + Math.sin(t * 10) * 0.2;
        rArmZ = -2.35 - Math.sin(t * 10) * 0.2;
        mouthScaleX = 1.35;
        mouthScaleY = 0.85;
        break;

      case 'ENCOURAGING':
        bodyRotX = 0.08;
        headRotX = Math.sin(t * 4) * 0.1;
        lArmZ = 1.05;
        lArmX = -0.4;
        rArmZ = -1.05;
        rArmX = -0.4;
        mouthScaleX = 1.15;
        mouthScaleY = 0.5;
        break;

      case 'CORRECTING':
        headRotZ = -0.08;
        headRotX = Math.sin(t * 3.5) * 0.07;
        rArmZ = -1.55;
        rArmX = -0.45 + Math.sin(t * 6) * 0.1;
        lArmZ = 0.35;
        mouthScaleY = 0.45 + Math.abs(Math.sin(t * 7)) * 0.4;
        break;

      case 'FAREWELL':
        bodyRotX = 0.14 * Math.abs(Math.sin(t * 2));
        lArmZ = 2.25 + Math.sin(t * 7) * 0.25;
        rArmZ = -2.25 - Math.sin(t * 7) * 0.25;
        mouthScaleX = 1.25;
        mouthScaleY = 0.7;
        break;
    }

    rootRef.current.position.y = THREE.MathUtils.lerp(rootRef.current.position.y, rootY, 0.15);
    rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, rootRotY, 0.12);
    bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, bodyRotX, 0.12);

    headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, headRotZ, 0.15);
    headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, headRotX, 0.15);
    headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, headRotY, 0.15);

    leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, lArmZ, 0.16);
    leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, lArmX, 0.16);
    rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, rArmZ, 0.16);
    rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, rArmX, 0.16);

    if (mouthRef.current) {
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, mouthScaleY, 0.3);
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, mouthScaleX, 0.3);
    }

    if (auraRingRef.current) {
      const pulse = state === 'LISTENING' || state === 'SPEAKING' ? 1.08 + Math.sin(t * 6) * 0.1 : 1.0;
      auraRingRef.current.scale.set(pulse, pulse, 1);
    }
  });

  const auraHex = STATE_META[state]?.auraColor || '#f97316';

  return (
    <group ref={rootRef} position={[0, -0.75, 0]}>
      {/* Pedestal & State Aura Ring */}
      <mesh position={[0, -0.58, 0]} receiveShadow>
        <cylinderGeometry args={[0.92, 1.05, 0.14, 36]} />
        <meshStandardMaterial color="#fde68a" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh ref={auraRingRef} position={[0, -0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 1.04, 40]} />
        <meshBasicMaterial color={auraHex} side={THREE.DoubleSide} />
      </mesh>

      {/* Legs & Shoes */}
      <group position={[0, -0.15, 0]}>
        {/* Left Leg */}
        <mesh position={[-0.22, -0.15, 0]}>
          <capsuleGeometry args={[0.11, 0.32, 12, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
        <mesh position={[-0.22, -0.42, 0.08]}>
          <boxGeometry args={[0.24, 0.14, 0.34]} />
          <meshStandardMaterial color="#f97316" roughness={0.4} />
        </mesh>

        {/* Right Leg */}
        <mesh position={[0.22, -0.15, 0]}>
          <capsuleGeometry args={[0.11, 0.32, 12, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
        <mesh position={[0.22, -0.42, 0.08]}>
          <boxGeometry args={[0.24, 0.14, 0.34]} />
          <meshStandardMaterial color="#f97316" roughness={0.4} />
        </mesh>
      </group>

      {/* Upper Body & Articulated Parts */}
      <group ref={bodyRef} position={[0, 0.38, 0]}>
        {/* Torso Hoodie/Sweater */}
        <mesh position={[0, 0, 0]} castShadow>
          <capsuleGeometry args={[0.42, 0.46, 16, 24]} />
          <meshStandardMaterial color="#ea580c" roughness={0.45} />
        </mesh>

        {/* Glowing Voice Core Emblem on Chest */}
        <mesh position={[0, 0.08, 0.41]}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color={auraHex} emissive={auraHex} emissiveIntensity={0.65} />
        </mesh>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.48, 0.22, 0]}>
          <mesh position={[-0.14, -0.24, 0]}>
            <capsuleGeometry args={[0.1, 0.38, 12, 16]} />
            <meshStandardMaterial color="#fb923c" roughness={0.45} />
          </mesh>
          {/* Left Hand */}
          <mesh position={[-0.18, -0.5, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color="#fed7aa" roughness={0.5} />
          </mesh>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.48, 0.22, 0]}>
          <mesh position={[0.14, -0.24, 0]}>
            <capsuleGeometry args={[0.1, 0.38, 12, 16]} />
            <meshStandardMaterial color="#fb923c" roughness={0.45} />
          </mesh>
          {/* Right Hand */}
          <mesh position={[0.18, -0.5, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color="#fed7aa" roughness={0.5} />
          </mesh>
        </group>

        {/* Articulated Head */}
        <group ref={headRef} position={[0, 0.78, 0]}>
          {/* Main Head Sphere */}
          <mesh castShadow>
            <sphereGeometry args={[0.52, 32, 32]} />
            <meshStandardMaterial color="#ffedd5" roughness={0.45} />
          </mesh>

          {/* Stylized Hair Tuft / Cap */}
          <mesh position={[0, 0.34, -0.04]} rotation={[-0.15, 0, 0]}>
            <sphereGeometry args={[0.44, 24, 24]} />
            <meshStandardMaterial color="#431407" roughness={0.6} />
          </mesh>

          {/* Language Tutor Headphones Band & Earcups */}
          <mesh position={[0, 0.08, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.54, 0.045, 16, 36, Math.PI]} />
            <meshStandardMaterial color="#0f172a" roughness={0.3} />
          </mesh>
          <mesh position={[-0.54, 0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.1, 20]} />
            <meshStandardMaterial color={auraHex} emissive={auraHex} emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0.54, 0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.1, 20]} />
            <meshStandardMaterial color={auraHex} emissive={auraHex} emissiveIntensity={0.35} />
          </mesh>

          {/* Rosy Cheeks */}
          <mesh position={[-0.28, -0.08, 0.43]}>
            <sphereGeometry args={[0.075, 16, 16]} />
            <meshStandardMaterial color="#fda4af" transparent opacity={0.75} />
          </mesh>
          <mesh position={[0.28, -0.08, 0.43]}>
            <sphereGeometry args={[0.075, 16, 16]} />
            <meshStandardMaterial color="#fda4af" transparent opacity={0.75} />
          </mesh>

          {/* Left & Right Eyes */}
          <mesh ref={leftEyeRef} position={[-0.18, 0.06, 0.47]}>
            <sphereGeometry args={[0.072, 20, 20]} />
            <meshStandardMaterial color="#0f172a" roughness={0.15} />
          </mesh>
          <mesh position={[-0.16, 0.085, 0.53]}>
            <sphereGeometry args={[0.024, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          <mesh ref={rightEyeRef} position={[0.18, 0.06, 0.47]}>
            <sphereGeometry args={[0.072, 20, 20]} />
            <meshStandardMaterial color="#0f172a" roughness={0.15} />
          </mesh>
          <mesh position={[0.2, 0.085, 0.53]}>
            <sphereGeometry args={[0.024, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          {/* Friendly Nose */}
          <mesh position={[0, -0.03, 0.52]}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshStandardMaterial color="#fdba74" roughness={0.5} />
          </mesh>

          {/* Articulated Mouth (animates during SPEAKING / HAPPY / GREETING) */}
          <mesh ref={mouthRef} position={[0, -0.19, 0.48]}>
            <capsuleGeometry args={[0.065, 0.08, 12, 16]} />
            <meshStandardMaterial color="#be123c" roughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

class WebGLErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const Buddy3D: React.FC<Buddy3DProps> = ({
  state,
  speechBubble,
  subText,
  languageName = 'Tamil',
  onSelectState,
  onSpeakGreeting,
  compact = false,
}) => {
  const [showStateTester, setShowStateTester] = useState(false);
  const meta = STATE_META[state] || STATE_META.IDLE;

  const fallbackCharacter = (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-orange-500 to-amber-300 flex items-center justify-center shadow-lg animate-bounce">
        <Smile className="w-16 h-16 text-white" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">Buddy AI ({meta.label})</p>
    </div>
  );

  const allStates: CharacterState[] = [
    'IDLE',
    'GREETING',
    'LISTENING',
    'SPEAKING',
    'THINKING',
    'HAPPY',
    'ENCOURAGING',
    'CORRECTING',
    'FAREWELL',
  ];

  return (
    <div className="relative bg-gradient-to-b from-amber-100/70 via-orange-50/50 to-white rounded-3xl border border-amber-200/80 shadow-sm overflow-hidden flex flex-col justify-between">
      {/* Top status badge & quick controls */}
      <div className="p-3.5 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm flex items-center gap-1.5 ${meta.badgeBg}`}>
            {state === 'LISTENING' && <Mic className="w-3.5 h-3.5" />}
            {state === 'SPEAKING' && <Volume2 className="w-3.5 h-3.5" />}
            {state === 'THINKING' && <Brain className="w-3.5 h-3.5" />}
            {state === 'HAPPY' && <Sparkles className="w-3.5 h-3.5" />}
            {state === 'ENCOURAGING' && <HeartHandshake className="w-3.5 h-3.5" />}
            {meta.label}
          </span>
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">{meta.description}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {onSpeakGreeting && (
            <button
              type="button"
              onClick={onSpeakGreeting}
              className="px-2.5 py-1 rounded-xl bg-white/90 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold flex items-center gap-1 transition shadow-sm"
              title={`Hear Buddy greet you in ${languageName}`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Say Hi
            </button>
          )}
          {onSelectState && (
            <button
              type="button"
              onClick={() => setShowStateTester(!showStateTester)}
              className="px-2.5 py-1 rounded-xl bg-white/80 hover:bg-amber-100 text-slate-600 border border-slate-200 text-xs font-medium transition"
              title="Preview Buddy's 9 animation states"
            >
              Pose ({state})
            </button>
          )}
        </div>
      </div>

      {/* Optional 9-State Pose Selector Bar */}
      {showStateTester && onSelectState && (
        <div className="px-3 pb-2 flex flex-wrap gap-1 z-10 border-b border-amber-200/60 bg-white/70 backdrop-blur-sm">
          {allStates.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onSelectState(st)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition ${
                state === st
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-amber-50 text-slate-600 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      )}

      {/* Speech Bubble Overlay */}
      {speechBubble && (
        <div className="mx-3.5 mt-1 p-3 rounded-2xl bg-white/95 border border-orange-200/90 shadow-sm z-10">
          <p className="text-sm font-bold text-slate-800 leading-snug">{speechBubble}</p>
          {subText && <p className="text-xs text-slate-500 mt-1">{subText}</p>}
        </div>
      )}

      {/* 3D Canvas Viewport */}
      <div className={`w-full ${compact ? 'h-60' : 'h-72 sm:h-80'} relative`}>
        <WebGLErrorBoundary fallback={fallbackCharacter}>
          <Canvas shadows camera={{ position: [0, 0.25, 3.25], fov: 38 }}>
            <ambientLight intensity={0.85} />
            <directionalLight position={[3, 5, 4]} intensity={1.15} castShadow />
            <pointLight position={[-3, 2, -2]} intensity={0.45} color="#fed7aa" />
            <ArticulatedBuddyCharacter state={state} />
          </Canvas>
        </WebGLErrorBoundary>
      </div>

      {/* Footer honesty caption */}
      <div className="px-3.5 py-2 bg-amber-50/90 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-slate-500">
        <span>Buddy 3D • {languageName} Coach</span>
        <span>State-driven speaking animation</span>
      </div>
    </div>
  );
};
