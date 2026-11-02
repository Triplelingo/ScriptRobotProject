import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function GuidePage() {
  const navigate = useNavigate()
  const [showSimModal, setShowSimModal] = useState(false)
  const [simStep, setSimStep] = useState(1)
  const [isPointerHovered, setIsPointerHovered] = useState(false)
  const [isPointerClicked, setIsPointerClicked] = useState(false)

  // 5-Step Simulation configuration extending to the Result/Evaluation page
  const simulationSteps = [
    {
      step: 1,
      title: '1단계: 대본 목록에서 대본 선택',
      route: '/upload',
      screenTitle: '대본 목록 (UploadPage)',
      badge: '대본 선택',
      targetDescription: '[연습 시작] 버튼으로 마우스가 이동하여 클릭합니다.',
      tip: '원하는 대본 카드의 [연습 시작]을 누르면 감정 분석 미리보기로 이동합니다.',
      renderScreen: (isHovered, isClicked) => (
        <div style={{ background: '#0F172A', borderRadius: '16px', padding: '22px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📝</span>
                <span style={{ fontWeight: '800', color: '#FFFFFF', fontSize: '16px' }}>Romeo and Juliet</span>
              </div>
              <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '6px' }}>
                영화/드라마 · 등장인물 2명 · 대사 14줄
              </div>
            </div>

            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                style={{
                  background: isClicked ? '#1D4ED8' : isHovered ? '#2563EB' : '#1E293B',
                  transform: isClicked ? 'scale(0.94)' : isHovered ? 'scale(1.02)' : 'scale(1)',
                  color: '#FFFFFF',
                  border: isHovered ? '2px solid #60A5FA' : '1px solid #334155',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '13px',
                  boxShadow: isClicked
                    ? '0 0 20px rgba(59, 130, 246, 0.9)'
                    : isHovered
                    ? '0 0 16px rgba(37, 99, 235, 0.5)'
                    : 'none',
                  transition: 'all 0.25s ease',
                  cursor: 'default'
                }}
              >
                연습 시작 🚀
              </button>

              <AnimatedPointer isHovered={isHovered} isClicked={isClicked} offsetX={18} offsetY={14} />
            </div>
          </div>
        </div>
      )
    },
    {
      step: 2,
      title: '2단계: AI 감정 분석 결과 점검',
      route: '/preview',
      screenTitle: '대본 미리보기 (PreviewPage)',
      badge: '감정 라벨링',
      targetDescription: '[😊 JOY] 감정 배지로 이동하여 클릭합니다.',
      tip: 'AI가 문맥을 분석해 감정(JOY, FEAR 등)을 태깅합니다. 배지를 눌러 수정도 가능해요.',
      renderScreen: (isHovered, isClicked) => (
        <div style={{ background: '#0F172A', borderRadius: '16px', padding: '22px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#60A5FA', fontWeight: '800', fontSize: '14px' }}>Romeo</span>

            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span
                style={{
                  background: isClicked ? '#FDE047' : isHovered ? '#FEF08A' : '#FEF3C7',
                  color: '#D97706',
                  transform: isClicked ? 'scale(1.12)' : isHovered ? 'scale(1.05)' : 'scale(1)',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: isHovered ? '2px solid #F59E0B' : '1px solid transparent',
                  boxShadow: isClicked ? '0 0 16px rgba(245, 158, 11, 0.7)' : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                <span>😊</span>
                <span>JOY</span>
              </span>

              <AnimatedPointer isHovered={isHovered} isClicked={isClicked} offsetX={16} offsetY={12} />
            </div>
          </div>
          <div style={{ fontSize: '14px', color: '#E2E8F0', fontStyle: 'italic', marginBottom: '14px' }}>
            "What light through yonder window breaks?"
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '700' }}>
              인물 배정으로 이동 ➡️
            </span>
          </div>
        </div>
      )
    },
    {
      step: 3,
      title: '3단계: 내가 연기할 캐릭터 or 그냥 듣기 선택',
      route: '/character',
      screenTitle: '등장인물 배정 (CharacterPage)',
      badge: '역할 지정',
      targetDescription: '[Juliet] 역할 카드로 이동하여 체크 선택합니다.',
      tip: '선택하지 않은 인물은 AI가 연기합니다. 🎧 그냥 듣기를 누르면 마이크 없이 감상만 진행돼요.',
      renderScreen: (isHovered, isClicked) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                background: isClicked ? 'rgba(37, 99, 235, 0.3)' : isHovered ? 'rgba(37, 99, 235, 0.18)' : 'rgba(30, 41, 59, 0.8)',
                border: isClicked ? '2px solid #3B82F6' : isHovered ? '2px solid #60A5FA' : '1px solid #334155',
                transform: isClicked ? 'scale(0.98)' : 'scale(1)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.25s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🤖</span>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: '#FFFFFF' }}>Juliet (내 역할)</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>사용자가 직접 마이크로 발화</div>
                </div>
              </div>
              <span style={{ color: '#60A5FA', fontWeight: '800', fontSize: '13px' }}>
                {isClicked ? '✓ 선택됨' : '선택'}
              </span>
            </div>

            <AnimatedPointer isHovered={isHovered} isClicked={isClicked} offsetX={180} offsetY={20} />
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1E293B', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>🎧</span>
              <div>
                <div style={{ fontWeight: '800', fontSize: '14px', color: '#CBD5E1' }}>그냥 듣기 (말하기 없음)</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>마이크 없이 음성 청취만 진행</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 4,
      title: '4단계: 실시간 AI 대화 & 발음 녹음',
      route: '/practice',
      screenTitle: '연습 진행 (PracticePage)',
      badge: '실전 대화',
      targetDescription: '[🎙️ 녹음 시작] 버튼으로 이동하여 녹음을 시작합니다.',
      tip: 'AI의 대사를 듣고 내 차례에 녹음 버튼을 누른 후 대사를 또박또박 발화하세요.',
      renderScreen: (isHovered, isClicked) => (
        <div style={{ background: '#0F172A', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <div style={{ color: '#93C5FD', fontSize: '12px', fontWeight: '800', marginBottom: '6px' }}>🎙️ 내 차례입니다</div>
          <div style={{ fontSize: '15px', color: '#FFFFFF', fontWeight: '800', marginBottom: '14px' }}>
            "O Romeo, Romeo! Wherefore art thou Romeo?"
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ background: '#111827', border: '1px solid #059669', padding: '5px 12px', borderRadius: '8px', color: '#34D399', fontWeight: '800', fontSize: '12px' }}>
              정확도 95점
            </span>
            <span style={{ background: '#111827', border: '1px solid #2563EB', padding: '5px 12px', borderRadius: '8px', color: '#60A5FA', fontWeight: '800', fontSize: '12px' }}>
              유창성 90점
            </span>
          </div>

          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              style={{
                padding: '10px 24px',
                background: isClicked ? '#DC2626' : isHovered ? '#B91C1C' : '#EF4444',
                transform: isClicked ? 'scale(0.92)' : isHovered ? 'scale(1.05)' : 'scale(1)',
                color: '#FFFFFF',
                border: isHovered ? '2px solid #FCA5A5' : 'none',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '800',
                boxShadow: isClicked ? '0 0 20px rgba(239, 68, 68, 0.9)' : '0 4px 12px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.25s ease'
              }}
            >
              {isClicked ? '🛑 녹음 중...' : '🎙️ 녹음 시작'}
            </button>

            <AnimatedPointer isHovered={isHovered} isClicked={isClicked} offsetX={24} offsetY={12} />
          </div>
        </div>
      )
    },
    {
      step: 5,
      title: '5단계: 종합 평가 & AI 피드백 확인',
      route: '/result',
      screenTitle: '결과 분석 (ResultPage)',
      badge: '최종 리포트',
      targetDescription: '[다시 연습하기] 버튼으로 이동하여 클릭합니다.',
      tip: '전체 연습에 대한 평균 점수, 감정별 완성도, AI(Ollama)의 상세 조언을 한눈에 점검합니다.',
      renderScreen: (isHovered, isClicked) => (
        <div style={{ background: '#0F172A', borderRadius: '16px', padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>총합 발음 점수</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#10B981', marginTop: '2px' }}>
                92<span style={{ fontSize: '13px', color: '#64748B' }}> / 100</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ background: '#1E293B', padding: '6px 10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>정확도</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#38BDF8' }}>94%</div>
              </div>
              <div style={{ background: '#1E293B', padding: '6px 10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>유창성</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#A78BFA' }}>90%</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#BFDBFE', marginBottom: '14px', lineHeight: '1.4' }}>
            🤖 <strong>AI 피드백:</strong> 강세와 억양이 훌륭하며 문장 연결이 매우 매끄럽습니다!
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                style={{
                  background: isClicked ? '#059669' : isHovered ? '#10B981' : '#1E293B',
                  transform: isClicked ? 'scale(0.94)' : isHovered ? 'scale(1.04)' : 'scale(1)',
                  color: '#FFFFFF',
                  border: isHovered ? '2px solid #34D399' : '1px solid #334155',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '800',
                  boxShadow: isClicked ? '0 0 16px rgba(16, 185, 129, 0.8)' : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                다시 연습하기 🔄
              </button>

              <AnimatedPointer isHovered={isHovered} isClicked={isClicked} offsetX={20} offsetY={10} />
            </div>
          </div>
        </div>
      )
    }
  ]

  const currentSim = simulationSteps[simStep - 1]

  useEffect(() => {
    if (!showSimModal) return

    setIsPointerHovered(false)
    setIsPointerClicked(false)

    const hoverTimer = setTimeout(() => {
      setIsPointerHovered(true)
    }, 450)

    const clickDownTimer = setTimeout(() => {
      setIsPointerClicked(true)
    }, 1100)

    return () => {
      clearTimeout(hoverTimer)
      clearTimeout(clickDownTimer)
    }
  }, [simStep, showSimModal])

  return (
    <div
      style={{
        backgroundColor: '#070D1E',
        minHeight: '100vh',
        color: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '36px 24px 80px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background glow lights */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '650px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.24) 0%, rgba(124, 58, 237, 0.14) 50%, transparent 75%)',
          filter: 'blur(75px)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div style={{ maxWidth: '960px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Top Navbar: Clean back navigation only */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '36px' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94A3B8',
              fontSize: '14px',
              fontWeight: '700',
              padding: '8px 16px',
              borderRadius: '12px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)'
            }}
          >
            ← 뒤로가기
          </button>
        </div>

{/* Hero Section */}
<div style={{ textAlign: 'center', marginBottom: '44px' }}>
  {/* Top Badge */}
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(37, 99, 235, 0.16)',
      border: '1px solid rgba(96, 165, 250, 0.35)',
      padding: '6px 16px',
      borderRadius: '24px',
      fontSize: '13px',
      fontWeight: '700',
      color: '#60A5FA',
      marginBottom: '16px'
    }}
  >
    <span>🎯</span> 마우스 클릭 인터랙티브 가이드
  </div>

  {/* Clean, Balanced Title */}
  <h1
    style={{
      fontSize: '32px',
      fontWeight: '700',  /* 🌟 Changed from 900 to 700 so Korean characters don't look blocky/distorted */
      letterSpacing: '-0.5px',
      margin: '0 0 12px 0',
      color: '#F8FAFC',
      wordBreak: 'keep-all'
    }}
  >
    ScriptBot 이용 가이드 & 시뮬레이터
  </h1>

  {/* Short, Natural, Native Korean Subtitle */}
  <p
    style={{
      color: '#94A3B8',
      fontSize: '15px',
      margin: '0 auto 26px',
      lineHeight: '1.6',
      wordBreak: 'keep-all'
    }}
  >
    마우스 포인터를 따라 각 화면의 사용법을 직접 체험해보세요.
  </p>

  {/* Clean Action Button */}
  <button
    type="button"
    onClick={() => {
      setSimStep(1)
      setShowSimModal(true)
    }}
    style={{
      padding: '13px 30px',
      background: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
      color: '#FFFFFF',
      border: '1px solid rgba(147, 197, 253, 0.45)',
      borderRadius: '30px',
      fontSize: '15px',
      fontWeight: '700',
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px'
    }}
  >
    <span style={{ fontSize: '18px' }}>🖱️</span>
    <span>시뮬레이션 가이드 시작</span>
    <span
      style={{
        fontSize: '12px',
        background: 'rgba(255, 255, 255, 0.2)',
        padding: '2px 8px',
        borderRadius: '12px'
      }}
    >
      5단계
    </span>
  </button>
</div>

        {/* 3 Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '44px' }}>
          {[
            { step: '01', emoji: '📜', title: '대본 & 역할 선택', desc: '대본을 선택하고 내 역할을 지정하세요. 듣기만 원하면 🎧 그냥 듣기도 가능합니다.' },
            { step: '02', emoji: '🎙️', title: 'AI와 실전 롤플레잉', desc: 'AI 음성을 듣고 내 차례가 오면 마이크로 실감나게 대사를 발화하세요.' },
            { step: '03', emoji: '📊', title: '종합 결과 리포트', desc: 'Azure 발음 채점과 로컬 Ollama AI의 피드백으로 취약점을 점검합니다.' }
          ].map((item) => (
            <div
              key={item.step}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '28px 24px',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '32px' }}>{item.emoji}</span>
                <span style={{ background: '#1E293B', color: '#60A5FA', fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '20px' }}>
                  STEP {item.step}
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', margin: '0 0 10px 0' }}>{item.title}</h3>
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: '1.65' }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* The ONLY Button Leading to /upload */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '22px',
            padding: '32px',
            textAlign: 'center',
            backdropFilter: 'blur(16px)'
          }}
        >
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 8px 0' }}>실전 연습 준비되셨나요?</h2>
          <p style={{ color: '#94A3B8', fontSize: '14px', margin: '0 0 20px 0' }}>준비된 대본으로 AI와 바로 대화를 시작해보세요.</p>
          <button
            type="button"
            onClick={() => navigate('/upload')}
            style={{
              padding: '14px 44px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(37, 99, 235, 0.45)'
            }}
          >
            지금 연습 시작하기 🏁
          </button>
        </div>
      </div>

      {/* Interactive Simulation Modal */}
      {showSimModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 7, 18, 0.88)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(160deg, #0F172A 0%, #0B1120 100%)',
              border: '1px solid rgba(96, 165, 250, 0.4)',
              borderRadius: '24px',
              maxWidth: '560px',
              width: '100%',
              padding: '30px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(37, 99, 235, 0.25)',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: 'rgba(37, 99, 235, 0.2)',
                    color: '#60A5FA',
                    border: '1px solid rgba(96, 165, 250, 0.3)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '800'
                  }}
                >
                  단계 {simStep} / {simulationSteps.length}
                </span>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>{currentSim.screenTitle}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  color: '#94A3B8',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Title & Route indicator */}
            <h2 style={{ fontSize: '19px', fontWeight: '800', margin: '0 0 6px 0', color: '#FFFFFF' }}>
              {currentSim.title}
            </h2>
            <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '700', marginBottom: '14px' }}>
              📍 대상 페이지: {currentSim.route}
            </div>

            {/* Target Description Banner */}
            <div
              style={{
                background: 'rgba(37, 99, 235, 0.14)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '16px',
                color: '#BFDBFE',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🎯</span>
              <span>{currentSim.targetDescription}</span>
            </div>

            {/* Simulated UI Card */}
            <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '16px' }}>
              {currentSim.renderScreen(isPointerHovered, isPointerClicked)}
            </div>

            {/* Tip Box */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '12px',
                color: '#CBD5E1',
                marginBottom: '22px',
                lineHeight: '1.5'
              }}
            >
              💡 <strong>Tip:</strong> {currentSim.tip}
            </div>

            {/* Modal Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                disabled={simStep === 1}
                onClick={() => setSimStep((prev) => prev - 1)}
                style={{
                  padding: '9px 18px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: simStep === 1 ? 'not-allowed' : 'pointer',
                  opacity: simStep === 1 ? 0.3 : 1
                }}
              >
                ◀ 이전
              </button>

              {simStep < simulationSteps.length ? (
                <button
                  type="button"
                  onClick={() => setSimStep((prev) => prev + 1)}
                  style={{
                    padding: '10px 22px',
                    background: '#2563EB',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
                  }}
                >
                  다음 단계 ▶
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  style={{
                    padding: '10px 24px',
                    background: '#334155',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  닫기 ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AnimatedPointer({ isHovered, isClicked, offsetX = 16, offsetY = 12 }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: isHovered ? `${offsetY}px` : '-40px',
        left: isHovered ? `${offsetX}px` : '-40px',
        transform: isClicked ? 'scale(0.88)' : isHovered ? 'scale(1.05)' : 'scale(1.2)',
        opacity: isHovered ? 1 : 0,
        transition: 'all 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
        pointerEvents: 'none',
        zIndex: 50,
        filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.7))'
      }}
    >
      <div style={{ fontSize: '28px', userSelect: 'none' }}>🖱️</div>
      {isClicked && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(96, 165, 250, 0.7)',
            animation: 'ping 0.8s cubic-bezier(0, 0, 0.2, 1) infinite',
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  )
}

export default GuidePage