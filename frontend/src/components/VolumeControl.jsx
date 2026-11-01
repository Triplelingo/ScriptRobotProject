// VolumeControl.jsx
// ─────────────────────────────────────────────────────────────
// 로봇(RPi5) 스피커 볼륨 조절 슬라이더
// - 화면 진입 시 서버에서 현재 볼륨을 읽어와 표시
// - 슬라이더를 움직이면 0.25초 동안 추가 입력이 없을 때 한 번만 서버로 전송 (요청 폭주 방지)
// - 0~100%: RPi ALSA 믹서로 조절 / 100% 초과: 소프트웨어 증폭 (최대 150%)
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'

const API = 'http://localhost:8000/api/robot/volume'   // 볼륨 조회·변경 엔드포인트
const MAX_VOLUME = 150                                  // 100 초과 구간은 소프트웨어 증폭

export default function VolumeControl() {
  const [volume, setVolume] = useState(100)     // 슬라이더에 표시되는 값
  const [saving, setSaving] = useState(false)   // 전송 중 표시용
  const [error, setError] = useState('')        // 전송 실패 메시지
  const timerRef = useRef(null)                 // 디바운스 타이머

  // 화면 진입 시 현재 볼륨 불러오기
  useEffect(() => {
    fetch(API)
      .then((res) => res.json())
      .then((data) => { if (typeof data.volume === 'number') setVolume(data.volume) })
      .catch(() => setError('볼륨 정보를 불러오지 못했습니다'))
    return () => clearTimeout(timerRef.current)   // 페이지를 나갈 때 대기 중인 전송 취소
  }, [])

  // 서버로 볼륨 전송 (서버가 RPi로 전달)
  const sendVolume = async (value) => {
    setSaving(true)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: value }),
      })
      const data = await res.json()
      setError(data.sent ? '' : '⚠️ 로봇 미연결 — 연결되면 자동 적용')   // 미연결이어도 서버에는 저장됨
    } catch {
      setError('⚠️ 서버 연결 안 됨')
    } finally {
      setSaving(false)
    }
  }

  // 슬라이더 조작: 화면 값은 즉시 반영, 서버 전송은 0.25초 디바운스
  const handleChange = (e) => {
    const value = Number(e.target.value)
    setVolume(value)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => sendVolume(value), 250)
  }

  const boosted = volume > 100   // 증폭 구간 여부 (음질이 깨질 수 있어 색으로 구분)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
      <span style={{ fontSize: '14px' }}>{volume === 0 ? '🔇' : '🔊'}</span>
      <input
        type="range"
        min={0}
        max={MAX_VOLUME}
        step={5}
        value={volume}
        onChange={handleChange}
        style={{ flex: 1, accentColor: boosted ? '#F59E0B' : '#60A5FA' }}   // 100% 초과 시 주황색
        aria-label="로봇 볼륨"
      />
      <span style={{ fontSize: '13px', fontWeight: '700', minWidth: '44px', textAlign: 'right',
                     color: boosted ? '#F59E0B' : undefined }}>
        {volume}%
      </span>
      {saving && <span style={{ fontSize: '12px', opacity: 0.6 }}>저장 중</span>}
      {error && <span style={{ fontSize: '12px', color: '#F87171' }}>{error}</span>}
    </div>
  )
}