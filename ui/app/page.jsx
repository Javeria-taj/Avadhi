'use client'

import { useState, useEffect, useRef } from 'react'

const H = 3600e3 // 1 hour in ms

function initialCases(t0) {
  const pmSteps = () => [
    { kn: 'ಹೊಲದ ಪೂರ್ಣ ನೋಟ — ದೂರದಿಂದ ಫೋಟೋ', en: 'Wide shot of the field', photo: true, done: false, shot: null },
    { kn: 'ಹಾನಿಯಾದ ಬೆಳೆಯ ಹತ್ತಿರದ ಫೋಟೋ', en: 'Close-up of damaged crop', photo: true, done: false, shot: null },
    { kn: 'ಪಾಲಿಸಿ / ಪ್ರೀಮಿಯಂ ರಸೀದಿಯ ಫೋಟೋ', en: 'Policy or premium receipt', photo: true, done: false, shot: null },
    { kn: 'ಹೆಲ್ಪ್‌ಲೈನ್ 14447 ಗೆ ಕರೆ ಮಾಡಿ', en: 'Call Krishi Rakshak 14447', photo: false, done: false, shot: null },
    { kn: 'ಕೃಷಿ ಅಧಿಕಾರಿಗೆ ತಿಳಿಸಿ', en: 'Inform the agriculture officer', photo: false, done: false, shot: null },
  ]

  const pmCh = () => [
    { kn: 'ಕೃಷಿ ರಕ್ಷಕ ಹೆಲ್ಪ್‌ಲೈನ್', en: 'Krishi Rakshak helpline', v: '14447' },
    { kn: 'ವಿಮಾ ಕಂಪನಿ ಶಾಖೆ', en: 'Insurer branch', v: '—' },
    { kn: 'ಕೃಷಿ ಇಲಾಖೆ ಕಚೇರಿ', en: 'Agriculture office', v: '—' },
  ]

  const pmExpl = 'ಆಲಿಕಲ್ಲು ಮಳೆಯಿಂದ ಆದ ಬೆಳೆ ನಷ್ಟವನ್ನು 72 ಗಂಟೆಗಳ ಒಳಗೆ ವಿಮಾ ಕಂಪನಿಗೆ ತಿಳಿಸಬೇಕು. ತಡವಾದರೆ, ಪಾಲಿಸಿ ಇದ್ದರೂ ಕ್ಲೈಮ್ ತಿರಸ್ಕೃತವಾಗಬಹುದು. ಈ ಗಡುವು ಸರ್ಕಾರಿ ನಿಯಮ — ಅಂದಾಜು ಅಲ್ಲ.'
  const pmExplEn = 'Crop loss from hailstorm must be reported to the insurance company within 72 hours. If late, the claim can be rejected even with a valid policy. This deadline is a government rule — not an estimate.'

  const pm2 = pmSteps()
  pm2[0].done = true
  pm2[0].shot = { at: '07:42', coords: '15.1502N 76.9328E' }

  return [
    {
      id: 'AVD-0152',
      rule: 'RBI 2017',
      schemeKn: 'ಅನಧಿಕೃತ ಬ್ಯಾಂಕ್ ವಹಿವಾಟು',
      schemeEn: 'Unauthorised bank transaction',
      metaKn: '₹18,400 · ಖಾತೆ ····4127',
      metaEn: '₹18,400 · A/C ····4127',
      eventDate: '28 JUL 2026 · SMS 11:05',
      eventDateEn: '28 JUL 2026 · SMS 11:05',
      windowH: 72,
      windowLabel: '3 ಕೆಲಸದ ದಿನ',
      windowLabelEn: '3 working days',
      deadline: t0 + 9 * H + 13 * 60e3 + 42e3,
      explKn: 'ನಿಮ್ಮ ಅನುಮತಿ ಇಲ್ಲದೆ ಖಾತೆಯಿಂದ ಹಣ ಹೋಗಿದ್ದರೆ, ಬ್ಯಾಂಕ್ ಸಂದೇಶ ಬಂದ 3 ಕೆಲಸದ ದಿನಗಳ ಒಳಗೆ ವರದಿ ಮಾಡಿದರೆ ನಿಮ್ಮ ಹೊಣೆ ಶೂನ್ಯ — ಪೂರ್ಣ ಹಣ ವಾಪಸ್ ಪಡೆಯುವ ಹಕ್ಕು ನಿಮ್ಮದು.',
      explEn: 'If money left your account without your permission, reporting within 3 working days of the bank’s SMS means zero liability — you have the right to a full refund.',
      steps: [
        { kn: 'ಬ್ಯಾಂಕ್ SMS ಸಂದೇಶದ ಫೋಟೋ ತೆಗೆಯಿರಿ', en: 'Photograph the bank SMS', photo: true, done: false, shot: null },
        { kn: 'ಪಾಸ್‌ಬುಕ್ / ಸ್ಟೇಟ್‌ಮೆಂಟ್ ನಮೂದಿನ ಫೋಟೋ', en: 'Photograph the passbook entry', photo: true, done: false, shot: null },
        { kn: 'ಬ್ಯಾಂಕ್ ಶಾಖೆಗೆ ಲಿಖಿತ ದೂರು ನೀಡಿ', en: 'File written complaint at branch', photo: false, done: false, shot: null },
        { kn: 'ದೂರು ಸ್ವೀಕೃತಿ ಸಂಖ್ಯೆ ಪಡೆದುಕೊಳ್ಳಿ', en: 'Collect acknowledgement number', photo: false, done: false, shot: null },
      ],
      channels: [
        { kn: 'ಬ್ಯಾಂಕ್ ಶಾಖೆ — ಲಿಖಿತ ದೂರು', en: 'Bank branch · written complaint', v: '—' },
        { kn: 'ಸೈಬರ್ ಸಹಾಯವಾಣಿ', en: 'Cyber fraud helpline', v: '1930' },
        { kn: 'RBI ದೂರು ಪೋರ್ಟಲ್', en: 'RBI CMS portal', v: 'cms.rbi.org.in' },
      ],
      src: 'rbi.org.in — DBR.No.Leg.BC.78/09.07.005/2017-18',
      verified: '2026-07-27',
    },
    {
      id: 'AVD-0149',
      rule: 'PMFBY §21(2)',
      schemeKn: 'ಬೆಳೆ ವಿಮೆ — ಆಲಿಕಲ್ಲು ಹಾನಿ',
      schemeEn: 'Crop insurance — hailstorm damage',
      metaKn: 'ಹತ್ತಿ · ~2 ಎಕರೆ',
      metaEn: 'Cotton · ~2 acres',
      eventDate: '28 JUL 2026 · ~ರಾತ್ರಿ',
      eventDateEn: '28 JUL 2026 · ~night',
      windowH: 72,
      windowLabel: '72 ಗಂಟೆ',
      windowLabelEn: '72 hours',
      deadline: t0 + 47 * H + 26 * 60e3 + 8e3,
      explKn: pmExpl,
      explEn: pmExplEn,
      steps: pm2,
      channels: pmCh(),
      src: 'pmfby.gov.in — ಮಾರ್ಗಸೂಚಿ §21(2)',
      verified: '2026-07-27',
    },
    {
      id: 'AVD-0134',
      rule: 'PMFBY §21(2)',
      schemeKn: 'ಬೆಳೆ ವಿಮೆ — ಅತಿವೃಷ್ಟಿ ಹಾನಿ',
      schemeEn: 'Crop insurance — excess rainfall',
      metaKn: 'ಮೆಕ್ಕೆಜೋಳ · ~1 ಎಕರೆ',
      metaEn: 'Maize · ~1 acre',
      eventDate: '18 JUL 2026',
      eventDateEn: '18 JUL 2026',
      windowH: 72,
      windowLabel: '72 ಗಂಟೆ',
      windowLabelEn: '72 hours',
      deadline: t0 - 6 * 24 * H,
      explKn: pmExpl,
      explEn: pmExplEn,
      steps: pmSteps(),
      channels: pmCh(),
      src: 'pmfby.gov.in — ಮಾರ್ಗಸೂಚಿ §21(2)',
      verified: '2026-07-10',
    },
  ]
}

export default function Home() {
  const t0Ref = useRef(Date.now())
  const [lang, setLang] = useState('kn')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('avadhi_lang')
      if (savedLang) {
        setLang(savedLang)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('avadhi_lang', lang)
    }
  }, [lang])
  const [screen, setScreen] = useState('home') // 'home' | 'intake' | 'case' | 'capture' | 'doc'
  const [caseId, setCaseId] = useState(null)
  const [now, setNow] = useState(Date.now())

  // Intake states
  const [intake, setIntake] = useState('idle') // 'idle' | 'recording' | 'processing' | 'clarify'
  const [recSec, setRecSec] = useState(0)

  // Capture states
  const [capCase, setCapCase] = useState(null)
  const [capIdx, setCapIdx] = useState(null)
  const [captured, setCaptured] = useState(false)
  const [capFrozen, setCapFrozen] = useState(null)

  // Scroll preservation for Evidence Checklist
  const s3SectionRef = useRef(null)
  const checklistRef = useRef(null)
  const savedChecklistScrollRef = useRef(350)

  // Document states
  const [docReady, setDocReady] = useState(true)
  const [shareFlash, setShareFlash] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  // Dynamic Geolocation State
  const [geoCoords, setGeoCoords] = useState({
    str: '15.1502° N  76.9328° E  ±8m',
    shortStr: '15.1502N 76.9328E',
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator && screen === 'capture') {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latVal = pos.coords.latitude
          const lngVal = pos.coords.longitude
          const accVal = Math.round(pos.coords.accuracy || 8)
          const latDir = latVal >= 0 ? 'N' : 'S'
          const lngDir = lngVal >= 0 ? 'E' : 'W'
          const latFormatted = Math.abs(latVal).toFixed(4)
          const lngFormatted = Math.abs(lngVal).toFixed(4)
          const str = `${latFormatted}° ${latDir}  ${lngFormatted}° ${lngDir}  ±${accVal}m`
          const shortStr = `${latFormatted}${latDir} ${lngFormatted}${lngDir}`
          setGeoCoords({ str, shortStr })
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }
  }, [screen])

  // Dynamic Camera Stream Refs & Effect
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    if (screen === 'capture') {
      let isMounted = true
      if (typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          })
          .then((stream) => {
            if (!isMounted) {
              stream.getTracks().forEach((t) => t.stop())
              return
            }
            streamRef.current = stream
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              videoRef.current.play().catch(() => {})
            }
          })
          .catch(() => {
            if (navigator.mediaDevices.getUserMedia) {
              navigator.mediaDevices
                .getUserMedia({ video: true, audio: false })
                .then((stream) => {
                  if (!isMounted) {
                    stream.getTracks().forEach((t) => t.stop())
                    return
                  }
                  streamRef.current = stream
                  if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    videoRef.current.play().catch(() => {})
                  }
                })
                .catch(() => {})
            }
          })
      }
      return () => {
        isMounted = false
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [screen])

  // Cases list
  const [cases, setCases] = useState([])

  useEffect(() => {
    setCases(initialCases(t0Ref.current))
  }, [])

  useEffect(() => {
    if (screen === 'case' && s3SectionRef.current) {
      const targetScroll = savedChecklistScrollRef.current > 0 ? savedChecklistScrollRef.current : 350
      s3SectionRef.current.scrollTop = targetScroll
    }
  }, [screen, cases])

  // Timer loop
  useEffect(() => {
    const iv = setInterval(() => {
      setNow(Date.now())
      if (intake === 'recording') {
        setRecSec((prev) => prev + 1)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [intake])

  const isKn = lang === 'kn'
  const L = (knText, enText) => (isKn ? knText : enText)

  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (ms) => {
    if (ms <= 0) return '00:00:00'
    const h = Math.floor(ms / H)
    const m = Math.floor((ms % H) / 60e3)
    const s = Math.floor((ms % 60e3) / 1e3)
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }
  const fmtShort = (ms) => {
    if (ms <= 0) return '00:00'
    const h = Math.floor(ms / H)
    const m = Math.floor((ms % H) / 60e3)
    return `${pad(h)}:${pad(m)}`
  }
  const due = (d) => {
    const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const x = new Date(d)
    return `${pad(x.getDate())} ${M[x.getMonth()]} ${pad(x.getHours())}:${pad(x.getMinutes())}`
  }
  const clock = (d) => {
    const x = new Date(d)
    return `${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`
  }

  const getStatus = (rem) => (rem <= 0 ? 'expired' : rem < 12 * H ? 'soon' : 'open')
  const getCol = (st) => ({ open: '#1b5e3f', soon: '#a05a00', expired: '#6f6b63' }[st])
  const getChip = (st) => ({ open: '#e8f2ec', soon: '#fdf3e4', expired: '#f1f0ec' }[st])
  const getBadge = (st) =>
    isKn
      ? { open: 'ಚಾಲ್ತಿ', soon: 'ಶೀಘ್ರ ಮುಕ್ತಾಯ', expired: 'ಅವಧಿ ಮೀರಿದೆ' }[st]
      : { open: 'Open', soon: 'Closing soon', expired: 'Expired' }[st]

  const cloneCases = () => cases.map((c) => ({ ...c, steps: c.steps.map((s) => ({ ...s })) }))

  const toggleStep = (id, i) => {
    const nextCases = cloneCases()
    const targetCase = nextCases.find((c) => c.id === id)
    if (targetCase && targetCase.steps[i]) {
      if (targetCase.steps[i].photo) return
      targetCase.steps[i].done = !targetCase.steps[i].done
      setCases(nextCases)
    }
  }

  const handleStopRec = () => {
    setIntake('processing')
    setTimeout(() => {
      setIntake('clarify')
    }, 1700)
  }

  const newCase = (opt) => {
    const nextCases = cloneCases()
    const c = {
      id: 'AVD-0153',
      rule: 'PMFBY §21(2)',
      schemeKn: 'ಬೆಳೆ ವಿಮೆ — ' + opt.kn,
      schemeEn: 'Crop insurance — ' + opt.en.toLowerCase(),
      metaKn: 'ಹತ್ತಿ · ~2 ಎಕರೆ',
      metaEn: 'Cotton · ~2 acres',
      eventDate: '29 JUL 2026 · ~ರಾತ್ರಿ',
      eventDateEn: '29 JUL 2026 · ~night',
      windowH: 72,
      windowLabel: '72 ಗಂಟೆ',
      windowLabelEn: '72 hours',
      deadline: now + 72 * H,
      explKn:
        'ಆಲಿಕಲ್ಲು/ಮಳೆ ಹಾನಿಯನ್ನು 72 ಗಂಟೆಗಳ ಒಳಗೆ ವಿಮಾ ಕಂಪನಿಗೆ ತಿಳಿಸಬೇಕು. ತಡವಾದರೆ, ಪಾಲಿಸಿ ಇದ್ದರೂ ಕ್ಲೈಮ್ ತಿರಸ್ಕೃತವಾಗಬಹುದು. ಈ ಗಡುವು ಸರ್ಕಾರಿ ನಿಯಮ — ಅಂದಾಜು ಅಲ್ಲ.',
      explEn:
        'Hail or rain damage must be reported to the insurance company within 72 hours. If late, the claim can be rejected even with a valid policy. This deadline is a government rule — not an estimate.',
      steps: [
        { kn: 'ಹೊಲದ ಪೂರ್ಣ ನೋಟ — ದೂರದಿಂದ ಫೋಟೋ', en: 'Wide shot of the field', photo: true, done: false, shot: null },
        { kn: 'ಹಾನಿಯಾದ ಬೆಳೆಯ ಹತ್ತಿರದ ಫೋಟೋ', en: 'Close-up of damaged crop', photo: true, done: false, shot: null },
        { kn: 'ಪಾಲಿಸಿ / ಪ್ರೀಮಿಯಂ ರಸೀದಿಯ ಫೋಟೋ', en: 'Policy or premium receipt', photo: true, done: false, shot: null },
        { kn: 'ಹೆಲ್ಪ್‌ಲೈನ್ 14447 ಗೆ ಕರೆ ಮಾಡಿ', en: 'Call Krishi Rakshak 14447', photo: false, done: false, shot: null },
        { kn: 'ಕೃಷಿ ಅಧಿಕಾರಿಗೆ ತಿಳಿಸಿ', en: 'Inform the agriculture officer', photo: false, done: false, shot: null },
      ],
      channels: [
        { kn: 'ಕೃಷಿ ರಕ್ಷಕ ಹೆಲ್ಪ್‌ಲೈನ್', en: 'Krishi Rakshak helpline', v: '14447' },
        { kn: 'ವಿಮಾ ಕಂಪನಿ ಶಾಖೆ', en: 'Insurer branch', v: '—' },
        { kn: 'ಕೃಷಿ ಇಲಾಖೆ ಕಚೇರಿ', en: 'Agriculture office', v: '—' },
      ],
      src: 'pmfby.gov.in — ಮಾರ್ಗಸೂಚಿ §21(2)',
      verified: '2026-07-27',
    }
    if (!nextCases.find((x) => x.id === c.id)) {
      nextCases.unshift(c)
    }
    setCases(nextCases)
    setCaseId(c.id)
    setScreen('case')
    setIntake('idle')
  }

  // Prepared data
  const cs = cases.map((c) => {
    const rem = c.deadline - now
    const st = getStatus(rem)
    return {
      ...c,
      rem,
      st,
      color: getCol(st),
      chipBg: getChip(st),
      pct: Math.max(0, Math.min(100, (1 - rem / (c.windowH * H)) * 100)),
    }
  })

  const live = cs.filter((c) => c.st !== 'expired').sort((a, b) => a.rem - b.rem)
  const dead = cs.filter((c) => c.st === 'expired')
  const soonCount = live.filter((c) => c.st === 'soon').length
  const empty = cs.length === 0

  const ac = cs.find((c) => c.id === caseId) || cs[0] || null

  const acSteps = ac
    ? ac.steps.map((s, i) => ({
        num: i + 1,
        main: L(s.kn, s.en),
        done: s.done,
        hasShot: !!s.shot,
        shotLabel: s.shot ? L('ಫೋಟೋ', 'Photo') + ' ✓ ' + s.shot.at + ' · ' + s.shot.coords : '',
        showCam: s.photo && !s.done,
        showBox: !s.photo && !s.done,
        numBg: s.done ? '#1b8a5a' : '#ffffff',
        numCol: s.done ? '#ffffff' : '#4a4740',
        numBorder: s.done ? '#1b8a5a' : '#d9d6cf',
        tap: () => {
          if (s3SectionRef.current && s3SectionRef.current.scrollTop > 0) {
            savedChecklistScrollRef.current = s3SectionRef.current.scrollTop
          }
          if (s.photo && !s.done) {
            setCapCase(ac.id)
            setCapIdx(i)
            setCaptured(false)
            setCapFrozen(null)
            setScreen('capture')
          } else {
            toggleStep(ac.id, i)
            if ((s.en && s.en.includes('14447')) || (s.kn && s.kn.includes('14447'))) {
              if (typeof window !== 'undefined') {
                window.location.href = 'tel:14447'
              }
            }
          }
        },
      }))
    : []

  const capStep = capCase != null && ac ? (cs.find((c) => c.id === capCase) || { steps: [] }).steps[capIdx] : null
  const capStamp = captured && capFrozen ? capFrozen : clock(now)

  const docFacts = ac
    ? [
        { k: L('ಘಟನೆ', 'Event'), v: L(ac.schemeKn, ac.schemeEn) },
        { k: L('ದಿನಾಂಕ', 'Date'), v: L(ac.eventDate, ac.eventDateEn) },
        { k: L('ವಿವರ', 'Details'), v: L(ac.metaKn, ac.metaEn) },
        { k: L('ಗಡುವು', 'Deadline'), v: due(ac.deadline) + ' IST · ' + L(ac.windowLabel, ac.windowLabelEn) },
        { k: L('ನಿಯಮ', 'Rule'), v: ac.rule },
      ]
    : []

  const docEvid = ac
    ? ac.steps.map((s, i) => (s.shot ? { tag: 'EV-0' + (i + 1), label: s.en, meta: s.shot.coords + ' · ' + s.shot.at + ' ✓' } : null)).filter(Boolean)
    : []

  // Text Strings
  const t = {
    appName: L('ಅವಧಿ', 'Avadhi'),
    appTag: L('Avadhi · ಸಮಯವೇ ಸಾಕ್ಷಿ', 'Time is evidence'),
    offline: L('ಆಫ್‌ಲೈನ್ ಸಿದ್ಧ', 'Offline ready'),
    toggle: isKn ? 'English' : 'ಕನ್ನಡ',
    bannerKn: L('ಎಚ್ಚರಿಕೆ — ಒಂದು ಗಡುವು 12 ಗಂಟೆಯೊಳಗೆ ಮುಗಿಯುತ್ತದೆ', 'Warning — one deadline closes within 12 hours'),
    bannerEn: L('ಈಗಲೇ ಕ್ರಮ ತೆಗೆದುಕೊಳ್ಳಿ', 'Act now'),
    emptyTitle: L('ಇನ್ನೂ ಯಾವ ಪ್ರಕರಣವೂ ಇಲ್ಲ', 'No cases yet'),
    emptyBody: L(
      'ನಷ್ಟವಾಗಿದ್ದರೆ, ಕೆಳಗಿನ ಗುಂಡಿ ಒತ್ತಿ ಕನ್ನಡದಲ್ಲಿ ಹೇಳಿ. ಗಡುವಿನ ಗಡಿಯಾರ ತಕ್ಷಣ ಶುರುವಾಗುತ್ತದೆ.',
      'If you have suffered a loss, tap the button below and speak. The deadline clock starts immediately.'
    ),
    reportMain: L('ನಷ್ಟ ವರದಿ ಮಾಡಿ', 'Report a loss'),
    reportSub: L('ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ · Report a loss', 'Tap and speak — no reading needed'),
    back: L('← ಹಿಂದೆ', '← Back'),
    newReport: L('ಹೊಸ ವರದಿ', 'New report'),
    whatHappened: L('ಏನಾಯಿತು?', 'What happened?'),
    intakeBody: L(
      'ನಿಮ್ಮ ಮಾತಿನಲ್ಲೇ ಹೇಳಿ — ಯಾವ ಬೆಳೆ ಅಥವಾ ಯಾವ ಖಾತೆ, ಎಷ್ಟು, ಯಾವಾಗ ಆಯಿತು. ಓದುವ, ಬರೆಯುವ ಅಗತ್ಯವಿಲ್ಲ.',
      'Say it in your own words — which crop or account, how much, and when it happened. No reading or writing needed.'
    ),
    recMain: L('ಒತ್ತಿ, ಮಾತನಾಡಿ', 'Tap to record'),
    recSub: L('Tap to record', 'Speak in your own words'),
    listening: L('ಕೇಳುತ್ತಿದೆ…', 'Listening…'),
    recHint: L('ನಿಧಾನವಾಗಿ, ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ. ಮುಗಿದ ಮೇಲೆ ಕೆಳಗಿನ ಗುಂಡಿ ಒತ್ತಿ.', 'Speak slowly and clearly. Tap the button below when you are done.'),
    stopMain: L('ನಿಲ್ಲಿಸಿ', 'Stop'),
    stopSub: L('Stop recording', 'Stop recording'),
    analysing: L('ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ…', 'Analysing…'),
    analysingSub: L('ಸಾಧನದಲ್ಲೇ · ನೆಟ್‌ವರ್ಕ್ ಇಲ್ಲದೆ', 'On-device · no network'),
    wait: L('ಕಾಯಿರಿ…', 'Please wait…'),
    factsLabel: L('ಗ್ರಹಿಸಿದ ವಿವರ', 'Facts extracted'),
    factCrop: L('ಬೆಳೆ', 'Crop'),
    factCropV: L('ಹತ್ತಿ', 'Cotton'),
    factWhen: L('ಸಮಯ', 'When'),
    factWhenV: L('ನಿನ್ನೆ ರಾತ್ರಿ', 'Last night'),
    factArea: L('ವಿಸ್ತೀರ್ಣ', 'Area'),
    factAreaV: L('~2 ಎಕರೆ', '~2 acres'),
    clarifyQ: L('ಹಾನಿ ಮಾಡಿದ್ದು ಏನು ಕಂಡಿರಿ?', 'What caused the damage?'),
    clarifySub: L('ಒಂದು ಉತ್ತರ ಆರಿಸಿ', 'Pick one answer'),
    privacy: L('ನಿಮ್ಮ ಧ್ವನಿ ಈ ಸಾಧನ ಬಿಟ್ಟು ಹೋಗುವುದಿಲ್ಲ', 'Your voice never leaves this device'),
    timeLeft: L('ಉಳಿದ ಸಮಯ', 'Time remaining'),
    hms: L('ಗಂಟೆ : ನಿಮಿಷ : ಸೆಕೆಂಡ್', 'hrs : min : sec'),
    deadline: L('ಗಡುವು', 'Deadline'),
    ruleWindow: L('ನಿಯಮದ ಅವಧಿ', 'Rule window'),
    checklist: L('ಸಾಕ್ಷ್ಯ ಪಟ್ಟಿ', 'Evidence checklist'),
    channels: L('ವರದಿ ಮಾಡುವ ಮಾರ್ಗ', 'Reporting channels'),
    genMain: L('ದಾಖಲೆ ತಯಾರಿಸಿ', 'Generate document'),
    genSub: L('Generate document · PDF', 'On-device PDF'),
    evidence: L('ಸಾಕ್ಷ್ಯ', 'Evidence'),
    camLive: L('ಕ್ಯಾಮೆರಾ · LIVE', 'Camera · LIVE'),
    capturedBadge: L('ದಾಖಲಾಗಿದೆ ✓', 'Captured ✓'),
    retake: L('ಮತ್ತೆ ತೆಗೆ', 'Retake'),
    attach: L('ಸರಿ, ಸೇರಿಸಿ', 'Attach to case'),
    stampNote: L('ಸ್ಥಳ ಮತ್ತು ಸಮಯ ಚಿತ್ರದ ಮೇಲೆ ಮುದ್ರೆಯಾಗುತ್ತದೆ', 'Location and time are stamped onto the photo'),
    docLabel: L('ದಾಖಲೆ', 'Document'),
    docGen: L('ತಯಾರಿಸಲಾಗುತ್ತಿದೆ…', 'Generating…'),
    docGenSub: L('ಸಾಧನದಲ್ಲೇ PDF ರಚನೆ', 'On-device PDF'),
    docTitle: L('ನಷ್ಟ ಸೂಚನಾ ವರದಿ', 'Loss intimation report'),
    docStampLabel: L('ರಚನೆ', 'Generated'),
    name: L('ಹೆಸರು', 'Name'),
    village: L('ಗ್ರಾಮ', 'Village'),
    evAttached: L('ಲಗತ್ತಿಸಿದ ಸಾಕ್ಷ್ಯ', 'Evidence attached'),
    declaration: ac
      ? L(
          'ಮೇಲಿನ ವಿವರ ಸತ್ಯವೆಂದು ಘೋಷಿಸುತ್ತೇನೆ. ಈ ವರದಿ ' + ac.rule + ' ನಿಯಮದಡಿ ಗಡುವಿನೊಳಗೆ ತಿಳಿಸುವ ಉದ್ದೇಶದ ಸೂಚನೆ.',
          'I declare that the details above are true. This report is an intimation intended to meet the deadline under ' + ac.rule + '.'
        )
      : '',
    sign: L('ಸಹಿ', 'Signature'),
    date: L('ದಿನಾಂಕ', 'Date'),
    docFooter2: L('AVADHI ಸಿದ್ಧಪಡಿಸಿದೆ — ಇದು ಅಧಿಕೃತ ಸಲ್ಲಿಕೆ ಅಲ್ಲ', 'Prepared with Avadhi — not the official submission channel'),
    caseBtn: L('ಪ್ರಕರಣ', 'Case'),
    docDownload: L('ದಾಖಲೆ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ (PDF)', 'Download document (PDF)'),
    docDownloaded: L('✓ PDF ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ', '✓ PDF Downloaded'),
  }

  const generatePdfAndDownload = (targetCase) => {
    if (!targetCase) return
    const reportId = `${targetCase.id || 'AVD-0153'}/2026`
    const title = "CROP LOSS INTIMATION REPORT"
    const scheme = (isKn ? targetCase.schemeKn : targetCase.schemeEn) || targetCase.schemeEn
    const rule = targetCase.rule || "PMFBY §21(2)"
    const date = (isKn ? targetCase.eventDate : targetCase.eventDateEn) || targetCase.eventDate
    const meta = (isKn ? targetCase.metaKn : targetCase.metaEn) || targetCase.metaEn
    const dueStr = targetCase.deadline ? new Date(targetCase.deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + " IST" : "72 hours"
    const src = targetCase.src || "pmfby.gov.in"
    const verified = targetCase.verified || "2026-07-27"

    const escapePdf = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

    const stepsAttached = (targetCase.steps || [])
      .filter((s) => s.shot)
      .map((s, i) => `EV-0${i + 1}: ${s.en} [${s.shot.coords} at ${s.shot.at} IST]`)

    const lines = [
      `AVADHI - ${title}`,
      `Report ID: ${reportId}`,
      `-----------------------------------------------------------------`,
      `Scheme: ${scheme}`,
      `Rule Reference: ${rule}`,
      `Event Date / Time: ${date}`,
      `Details: ${meta}`,
      `Filing Deadline: ${dueStr}`,
      `-----------------------------------------------------------------`,
      `FARMER DETAILS (TO BE FILLED BY HAND):`,
      `Farmer Name: ____________________________________________________`,
      `Village / Panchayat: ___________________________________________`,
      `Policy / Application No: ________________________________________`,
      `Bank Account No: _______________________________________________`,
      `Mobile No: ____________________________________________________`,
      `-----------------------------------------------------------------`,
      `EVIDENCE ATTACHED:`,
      ...(stepsAttached.length > 0 ? stepsAttached : [`EV-01: Wide shot of field (15.1502N 76.9328E at 07:42 IST)`]),
      `-----------------------------------------------------------------`,
      `LEGAL DECLARATION:`,
      `I declare that the details above are true. This report is an`,
      `intimation intended to meet the deadline under ${rule}.`,
      `-----------------------------------------------------------------`,
      `Signature: ______________________      Date: ____________________`,
      `-----------------------------------------------------------------`,
      `Rule Source: ${src} | Verified: ${verified}`,
      `Prepared with Avadhi - Voice-First Offline Claim Navigator`,
    ]

    let textStream = ""
    let y = 740
    lines.forEach((lineText, idx) => {
      const isHeader = idx === 0
      const isSection =
        lineText.startsWith("FARMER DETAILS") ||
        lineText.startsWith("EVIDENCE") ||
        lineText.startsWith("LEGAL DECLARATION")
      const font = isHeader ? "/F1 14 Tf" : isSection ? "/F1 10 Tf" : "/F2 9.5 Tf"
      textStream += `BT ${font} 45 ${y} Td (${escapePdf(lineText)}) Tj ET\n`
      y -= lineText === "" ? 8 : isHeader ? 22 : 15
    })

    const pdfContent = [
      "%PDF-1.4\n",
      "1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n",
      "2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n",
      "3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>> >> endobj\n",
      "5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj\n",
      "6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n",
      `4 0 obj <</Length ${textStream.length}>> stream\n${textStream}\nendstream\nendobj\n`,
      `xref\n0 7\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000300 00000 n\n0000000225 00000 n\n0000000262 00000 n\ntrailer <</Size 7 /Root 1 0 R>>\nstartxref\n500\n%%EOF`,
    ].join("")

    const blob = new Blob([pdfContent], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${targetCase.id || 'AVD-0153'}_Loss_Intimation_Report.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', height: '100vh', background: '#f8f7f3', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Success Toast */}
      {showSuccessToast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#1b5e3f',
            color: '#ffffff',
            padding: '14px 24px',
            borderRadius: 14,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 16,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {L('ಯಶಸ್ವಿಯಾಗಿ ನೋಂದಾಯಿಸಲಾಗಿದೆ!', 'Registered successfully!')}
        </div>
      )}
      {/* Global Persistent TopBar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '24px 20px 16px',
          background: '#e2e8e2',
          borderBottom: '1px solid #d0d7cf',
          flex: 'none',
        }}
      >
        <div>
          <div style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-0.02em', color: '#1c1c1a', lineHeight: 1.15, fontFamily: 'Georgia, serif' }}>
            {t.appName}
          </div>
          <div style={{ fontSize: 13, color: '#6f6b63', marginTop: 3, fontWeight: 500 }}>
            {t.appTag}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#f1f0ec',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: '#4a4740',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1b8a5a', display: 'inline-block' }} />
            {t.offline}
          </div>
          <button
            onClick={() => setLang(isKn ? 'en' : 'kn')}
            style={{
              background: '#ffffff',
              border: '1px solid #d9d6cf',
              borderRadius: 999,
              padding: '6px 15px',
              fontSize: 13,
              fontWeight: 700,
              color: '#1c1c1a',
              minHeight: 34,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            {t.toggle}
          </button>
        </div>
      </header>

      {/* S1 Home Screen */}
      {screen === 'home' && (
        <section data-screen-label="S1 Home" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 140px' }}>

          <div style={{ fontSize: 16, fontWeight: 600, color: '#4a4740', margin: '22px 0 12px' }}>
            {(empty ? 0 : cs.length) + ' ' + L('ಪ್ರಕರಣ ದಾಖಲೆಯಲ್ಲಿ', 'cases on record')}
          </div>

          {!empty && soonCount > 0 && (
            <div
              style={{
                background: '#fdf3e4',
                border: '1px solid #ecd9b8',
                borderRadius: 14,
                padding: '14px 16px',
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#a05a00', flex: 'none', animation: 'pulse 1.2s infinite' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: '#5c3400' }}>{t.bannerKn}</div>
                <div style={{ fontSize: 12, color: '#8a5a10', marginTop: 2 }}>{t.bannerEn}</div>
              </div>
            </div>
          )}

          {empty && (
            <div style={{ background: '#fafaf8', border: '1px solid #e9e7e2', borderRadius: 16, padding: '40px 24px', textAlign: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t.emptyTitle}</div>
              <div style={{ fontSize: 15, color: '#6f6b63', marginTop: 8, lineHeight: 1.6 }}>{t.emptyBody}</div>
            </div>
          )}

          {!empty &&
            [...live, ...dead].map((c) => {
              const hoursText = fmtShort(c.rem)
              const unitText = c.st === 'expired' ? L('ಮುಗಿದಿದೆ', 'closed') : L('ಗಂ:ನಿ ಉಳಿದಿದೆ', 'hrs:min left')
              const schemeEnText = isKn ? `${c.schemeEn} · ${c.metaKn}` : c.metaEn
              const dueText = L('ಗಡುವು ', 'Due ') + due(c.deadline)
              const doneLabel = `${c.steps.filter((x) => x.done).length}/${c.steps.length} ${L('ಹಂತ', 'steps')}`

              return (
                <article
                  key={c.id}
                  onClick={() => {
                    setCaseId(c.id)
                    setScreen('case')
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e9e7e2',
                    borderRadius: 16,
                    marginBottom: 12,
                    padding: '16px 18px',
                    cursor: 'pointer',
                    opacity: c.st === 'expired' ? '0.55' : '1',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6f6b63' }}>
                      {c.id} · {c.rule}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: c.color,
                        background: c.chipBg,
                        borderRadius: 999,
                        padding: '4px 11px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                      {getBadge(c.st)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
                    <span
                      style={{
                        fontSize: 34,
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'tabular-nums',
                        color: c.color,
                        lineHeight: 1,
                      }}
                    >
                      {hoursText}
                    </span>
                    <span style={{ fontSize: 12, color: '#6f6b63' }}>{unitText}</span>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10, lineHeight: 1.35 }}>{L(c.schemeKn, c.schemeEn)}</div>
                  <div style={{ fontSize: 12, color: '#6f6b63', marginTop: 2 }}>{schemeEnText}</div>
                  <div style={{ position: 'relative', height: 6, borderRadius: 999, background: '#eeece7', marginTop: 14, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${c.pct}%`, borderRadius: 999, background: c.color }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6f6b63', marginTop: 7 }}>
                    <span>{dueText}</span>
                    <span>{doneLabel}</span>
                  </div>
                </article>
              )
            })}

          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10 }}>
            <div style={{ maxWidth: 560, margin: '0 auto', background: 'linear-gradient(to top,#f8f7f3 70%,rgba(248,247,243,0))', padding: '20px' }}>
              <button
                onClick={() => {
                  setIntake('idle')
                  setRecSec(0)
                  setScreen('intake')
                }}
                style={{
                  width: '100%',
                  minHeight: 64,
                  background: '#1c1c1a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '14px 20px',
                }}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                  <path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="18" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{t.reportMain}</span>
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.7, marginTop: 1 }}>{t.reportSub}</span>
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* S2 Voice Intake Screen */}
      {screen === 'intake' && (
        <section data-screen-label="S2 Voice Intake" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => {
                setScreen('home')
                setIntake('idle')
              }}
              style={{
                background: '#ffffff',
                border: '1px solid #d9d6cf',
                borderRadius: 999,
                padding: '6px 15px',
                fontSize: 13,
                fontWeight: 700,
                color: '#1c1c1a',
                minHeight: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              {t.back}
            </button>
            <span style={{ fontSize: 12, color: '#6f6b63' }}>{t.newReport}</span>
          </header>

          {intake === 'idle' && (
            <>
              <div style={{ paddingTop: 16, marginBottom: 28 }}>
                <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, lineHeight: 1.25 }}>{t.whatHappened}</h1>
                <p style={{ fontSize: 16, lineHeight: 1.65, color: '#4a4740', margin: '14px 0 0' }}>{t.intakeBody}</p>
              </div>
              <button
                onClick={() => {
                  setIntake('recording')
                  setRecSec(0)
                }}
                style={{
                  width: '100%',
                  minHeight: 68,
                  background: '#1c1c1a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                  <path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="18" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{t.recMain}</span>
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.7, marginTop: 1 }}>{t.recSub}</span>
                </span>
              </button>
            </>
          )}

          {intake === 'recording' && (
            <>
              <div style={{ paddingTop: 16, marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#b3341e', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#b3341e', animation: 'pulse 1.2s infinite' }} />
                  {t.listening}
                </div>
                <div style={{ fontSize: 58, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 16, letterSpacing: '-0.02em' }}>
                  {'00:' + pad(recSec)}
                </div>
                <p style={{ fontSize: 16, lineHeight: 1.65, color: '#4a4740', margin: '18px 0 0' }}>{t.recHint}</p>
              </div>
              <button
                onClick={handleStopRec}
                style={{
                  width: '100%',
                  minHeight: 68,
                  background: '#b3341e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <span style={{ width: 16, height: 16, borderRadius: 3, background: '#ffffff', display: 'inline-block' }} />
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{t.stopMain}</span>
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.75, marginTop: 1 }}>{t.stopSub}</span>
                </span>
              </button>
            </>
          )}

          {intake === 'processing' && (
            <>
              <div style={{ paddingTop: 36, marginBottom: 36, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#4a4740', animation: 'pulse 1.2s infinite' }}>{t.analysing}</div>
                <div style={{ fontSize: 12, color: '#9a968d', marginTop: 8 }}>{t.analysingSub}</div>
              </div>
              <button
                disabled
                style={{
                  width: '100%',
                  minHeight: 68,
                  background: '#1c1c1a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  opacity: 0.4,
                  cursor: 'wait',
                  fontSize: 17,
                  fontWeight: 700,
                }}
              >
                {t.wait}
              </button>
            </>
          )}

          {intake === 'clarify' && (
            <div style={{ paddingTop: 16, marginBottom: 20 }}>
              <div style={{ background: '#fafaf8', border: '1px solid #e9e7e2', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4a4740', marginBottom: 8 }}>{t.factsLabel}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '7px 0', borderTop: '1px solid #eeece7' }}>
                  <span style={{ color: '#6f6b63' }}>{t.factCrop}</span>
                  <span style={{ fontWeight: 700 }}>{t.factCropV}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '7px 0', borderTop: '1px solid #eeece7' }}>
                  <span style={{ color: '#6f6b63' }}>{t.factWhen}</span>
                  <span style={{ fontWeight: 700 }}>{t.factWhenV}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '7px 0', borderTop: '1px solid #eeece7' }}>
                  <span style={{ color: '#6f6b63' }}>{t.factArea}</span>
                  <span style={{ fontWeight: 700 }}>{t.factAreaV}</span>
                </div>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '26px 0 4px', lineHeight: 1.35 }}>{t.clarifyQ}</h2>
              <div style={{ fontSize: 13, color: '#6f6b63', marginBottom: 16 }}>{t.clarifySub}</div>
              {[
                { kn: 'ಆಲಿಕಲ್ಲು ಮಳೆ', en: 'Hailstorm' },
                { kn: 'ಅತಿವೃಷ್ಟಿ — ನೀರು ನಿಂತಿದೆ', en: 'Flooding / waterlogging' },
                { kn: 'ಬಿರುಗಾಳಿ / ಗಾಳಿ ಹಾನಿ', en: 'Windstorm' },
              ].map((o, idx) => (
                <button
                  key={idx}
                  onClick={() => newCase(o)}
                  style={{
                    width: '100%',
                    minHeight: 60,
                    textAlign: 'left',
                    background: '#ffffff',
                    border: '1px solid #d9d6cf',
                    borderRadius: 14,
                    padding: '14px 18px',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{L(o.kn, o.en)}</span>
                  {isKn && <span style={{ display: 'block', fontSize: 12, color: '#6f6b63', marginTop: 1 }}>{o.en}</span>}
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              fontSize: 13.5,
              color: '#1b5e3f',
              fontWeight: 700,
              textAlign: 'center',
              marginTop: 14,
              marginBottom: 4,
              lineHeight: 1.6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              flex: 'none',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {t.privacy}
          </div>
        </section>
      )}

      {/* S3 Case Detail Screen */}
      {screen === 'case' && ac && (
        <section
          ref={s3SectionRef}
          data-screen-label="S3 Case Detail"
          onScroll={(e) => {
            if (e.currentTarget.scrollTop > 0) {
              savedChecklistScrollRef.current = e.currentTarget.scrollTop
            }
          }}
          style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setScreen('home')}
              style={{
                background: '#ffffff',
                border: '1px solid #d9d6cf',
                borderRadius: 999,
                padding: '6px 15px',
                fontSize: 13,
                fontWeight: 700,
                color: '#1c1c1a',
                minHeight: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              {t.back}
            </button>
            <span style={{ fontSize: 12, color: '#6f6b63' }}>
              {ac.id} · {ac.rule}
            </span>
          </header>

          <div style={{ background: '#fafaf8', border: '1px solid #e9e7e2', borderRadius: 18, padding: '18px 20px', marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6f6b63' }}>{t.timeLeft}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: ac.color,
                  background: ac.chipBg,
                  borderRadius: 999,
                  padding: '4px 11px',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                {getBadge(ac.st)}
              </span>
            </div>
            <div
              style={{
                fontSize: 'clamp(48px,14vw,72px)',
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                color: ac.color,
                marginTop: 12,
              }}
            >
              {fmt(ac.rem)}
            </div>
            <div style={{ fontSize: 12, color: '#9a968d', marginTop: 6 }}>{t.hms}</div>
            <div style={{ position: 'relative', height: 8, borderRadius: 999, background: '#eeece7', marginTop: 16, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${ac.pct}%`, borderRadius: 999, background: ac.color }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eeece7', marginTop: 16, paddingTop: 11, fontSize: 13 }}>
              <span style={{ color: '#6f6b63' }}>{t.deadline}</span>
              <span style={{ fontWeight: 700 }}>{due(ac.deadline)} IST</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
              <span style={{ color: '#6f6b63' }}>{t.ruleWindow}</span>
              <span style={{ fontWeight: 700 }}>{L(ac.windowLabel, ac.windowLabelEn)}</span>
            </div>
          </div>

          <h2 style={{ fontSize: 19, fontWeight: 700, margin: '22px 0 3px', lineHeight: 1.4 }}>{L(ac.schemeKn, ac.schemeEn)}</h2>
          <div style={{ fontSize: 12, color: '#6f6b63' }}>{isKn ? `${ac.schemeEn} · ${ac.metaKn}` : ac.metaEn}</div>
          <p style={{ fontSize: 16, lineHeight: 1.65, margin: '12px 0 0', color: '#2e2d2a' }}>{L(ac.explKn, ac.explEn)}</p>

          <div ref={checklistRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '28px 0 12px' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{t.checklist}</span>
            <span style={{ fontSize: 13, color: '#6f6b63' }}>{ac.steps.filter((x) => x.done).length + ' / ' + ac.steps.length}</span>
          </div>

          {acSteps.map((s) => (
            <div
              key={s.num}
              onClick={s.tap}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: '#ffffff',
                border: '1px solid #e9e7e2',
                borderRadius: 14,
                marginBottom: 9,
                cursor: 'pointer',
                minHeight: 60,
                padding: '12px 16px',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  fontSize: 14,
                  fontWeight: 700,
                  background: s.numBg,
                  color: s.numCol,
                  border: `1px solid ${s.numBorder}`,
                }}
              >
                {s.num}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{s.main}</div>
                {s.hasShot && <div style={{ fontSize: 12, color: '#1b5e3f', marginTop: 4 }}>{s.shotLabel}</div>}
              </div>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6f6b63' }}>
                {s.done && (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M4 13l5 5L20 7" fill="none" stroke="#1b8a5a" strokeWidth="2.5" />
                  </svg>
                )}
                {s.showCam && (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M3 7h4l2-3h6l2 3h4v13H3z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                )}
                {s.showBox && <span style={{ width: 18, height: 18, borderRadius: 6, border: '1.5px solid #c6c2b9', display: 'inline-block' }} />}
              </div>
            </div>
          ))}

          <div style={{ fontSize: 15, fontWeight: 700, margin: '26px 0 12px' }}>{t.channels}</div>
          <div style={{ background: '#ffffff', border: '1px solid #e9e7e2', borderRadius: 14, overflow: 'hidden' }}>
            {ac.channels.map((ch, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 16px',
                  borderBottom: idx < ac.channels.length - 1 ? '1px solid #eeece7' : 'none',
                }}
              >
                <span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{L(ch.kn, ch.en)}</span>
                  {isKn && <span style={{ display: 'block', fontSize: 12, color: '#6f6b63', marginTop: 1 }}>{ch.en}</span>}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{ch.v}</span>
              </div>
            ))}
          </div>

          {(() => {
            const allDone = ac.steps.every((s) => s.done)
            return (
              <button
                disabled={!allDone}
                onClick={() => {
                  if (!allDone) return
                  setDocReady(false)
                  setScreen('doc')
                  setTimeout(() => setDocReady(true), 900)
                }}
                style={{
                  width: '100%',
                  minHeight: 60,
                  background: '#1c1c1a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  marginTop: 24,
                  padding: '12px 20px',
                  opacity: allDone ? 1 : 0.45,
                  cursor: allDone ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.2s ease',
                }}
              >
                <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{t.genMain}</span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.75, marginTop: 1 }}>
                  {allDone ? t.genSub : L('ಎಲ್ಲಾ ಸಾಕ್ಷ್ಯ ಹಂತಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ', 'Complete all checklist items first')}
                </span>
              </button>
            )
          })()}

          <div style={{ borderTop: '1px solid #eeece7', marginTop: 26, paddingTop: 12, fontSize: 12, color: '#9a968d', lineHeight: 1.7 }}>
            {L('ಮೂಲ', 'Source') + ' — ' + ac.src}
            <br />
            {L('ಪರಿಶೀಲಿಸಿದ ದಿನಾಂಕ', 'Verified') + ' — ' + ac.verified + ' · ' + L('ಗಡುವನ್ನು ನಿಯಮ ಎಂಜಿನ್ ಲೆಕ್ಕಹಾಕಿದೆ, AI ಅಲ್ಲ', 'deadline computed by rules engine, not AI')}
          </div>
        </section>
      )}

      {/* S4 Capture Evidence Screen */}
      {screen === 'capture' && (
        <section data-screen-label="S4 Capture Evidence" style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => {
                setCaptured(false)
                setScreen('case')
              }}
              style={{
                background: '#ffffff',
                border: '1px solid #d9d6cf',
                borderRadius: 999,
                padding: '6px 15px',
                fontSize: 13,
                fontWeight: 700,
                color: '#1c1c1a',
                minHeight: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              {t.back}
            </button>
            <span style={{ fontSize: 12, color: '#6f6b63' }}>
              {t.evidence} {capStep ? L('ಹಂತ', 'Step') + ' ' + (capIdx + 1) : ''}
            </span>
          </header>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginTop: 16 }}>{capStep ? L(capStep.kn, capStep.en) : ''}</div>

          <div style={{ position: 'relative', marginTop: 14, aspectRatio: '3/3.6', background: '#1c1c1a', borderRadius: 18, overflow: 'hidden' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: captured ? 'none' : 'block' }}
            />
            {captured && (
              <div style={{ width: '100%', height: '100%', background: '#26292b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8">
                  <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </div>
            )}
            {!captured && (
              <div style={{ position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center', fontSize: 12, letterSpacing: '0.06em', color: 'rgba(255,255,255,.9)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#e05a44', marginRight: 7, animation: 'pulse 1.2s infinite', verticalAlign: 'middle' }} />
                {t.camLive}
              </div>
            )}
            {captured && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  background: 'rgba(28,28,26,.85)',
                  border: '1px solid rgba(255,255,255,.5)',
                  borderRadius: 999,
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '8px 18px',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.capturedBadge}
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                left: 14,
                bottom: 14,
                fontSize: 12,
                lineHeight: 1.7,
                color: '#ffffff',
                background: 'rgba(28,28,26,.6)',
                borderRadius: 10,
                padding: '8px 12px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {geoCoords.str}
              <br />
              {capStamp} IST · 30 JUL 2026
            </div>
          </div>

          {!captured && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button
                onClick={() => {
                  setCaptured(true)
                  setCapFrozen(clock(now))
                }}
                aria-label="Capture"
                style={{ width: 78, height: 78, borderRadius: '50%', background: '#ffffff', border: '3px solid #1c1c1a', position: 'relative' }}
              >
                <span style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: '#1c1c1a' }} />
              </button>
            </div>
          )}

          {captured && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => {
                  setCaptured(false)
                  setCapFrozen(null)
                }}
                style={{ flex: 1, minHeight: 56, background: '#ffffff', border: '1px solid #d9d6cf', borderRadius: 999, fontSize: 15, fontWeight: 700 }}
              >
                {t.retake}
              </button>
              <button
                onClick={() => {
                  const nextCases = cloneCases()
                  const targetCase = nextCases.find((c) => c.id === capCase)
                  if (targetCase && targetCase.steps[capIdx]) {
                    targetCase.steps[capIdx].done = true
                    targetCase.steps[capIdx].shot = {
                      at: capFrozen ? capFrozen.slice(0, 5) : '--:--',
                      coords: geoCoords.shortStr,
                    }
                  }
                  setCases(nextCases)
                  setCaseId(capCase)
                  setCaptured(false)
                  setCapFrozen(null)
                  setScreen('case')
                }}
                style={{ flex: 2, minHeight: 56, background: '#1b5e3f', color: '#ffffff', border: 'none', borderRadius: 999, fontSize: 15, fontWeight: 700 }}
              >
                {t.attach}
              </button>
            </div>
          )}

          <div style={{ fontSize: 12, color: '#9a968d', textAlign: 'center', marginTop: 18, lineHeight: 1.7 }}>{t.stampNote}</div>
        </section>
      )}

      {/* S5 Document Preview Screen */}
      {screen === 'doc' && ac && (
        <section data-screen-label="S5 Document Preview" style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 120px', background: '#eaf0eb' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setScreen('case')}
              style={{
                background: '#ffffff',
                border: '1px solid #d9d6cf',
                borderRadius: 999,
                padding: '6px 15px',
                fontSize: 13,
                fontWeight: 700,
                color: '#1c1c1a',
                minHeight: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              {t.back}
            </button>
            <span style={{ fontSize: 12, color: '#6f6b63' }}>{t.docLabel}</span>
          </header>

          {!docReady && (
            <div style={{ padding: '100px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, animation: 'pulse 1.2s infinite' }}>{t.docGen}</div>
              <div style={{ fontSize: 12, color: '#9a968d', marginTop: 8 }}>{t.docGenSub}</div>
            </div>
          )}

          {docReady && (
            <>
              <div style={{ background: '#ffffff', border: '1px solid #e5e3de', borderRadius: 12, boxShadow: '0 1px 3px rgba(28,28,26,.06)', padding: '24px 20px', marginTop: 14 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>{t.docTitle}</div>
                  {isKn && <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6f6b63', marginTop: 3 }}>LOSS INTIMATION REPORT</div>}
                  <div style={{ fontSize: 12, color: '#6f6b63', marginTop: 8 }}>
                    {ac.id}/2026 · {t.docStampLabel} {due(now)} IST
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e3de', margin: '16px 0' }} />

                <div style={{ display: 'flex', gap: 14, padding: '8px 0', borderBottom: '1px solid #eeece7' }}>
                  <span style={{ flex: 'none', width: 88, fontSize: 12, color: '#6f6b63', paddingTop: 3 }}>{t.name}</span>
                  <span style={{ flex: 1, borderBottom: '1px solid #c6c2b9', minHeight: 22 }} />
                </div>
                <div style={{ display: 'flex', gap: 14, padding: '8px 0', borderBottom: '1px solid #eeece7' }}>
                  <span style={{ flex: 'none', width: 88, fontSize: 12, color: '#6f6b63', paddingTop: 3 }}>{t.village}</span>
                  <span style={{ flex: 1, borderBottom: '1px solid #c6c2b9', minHeight: 22 }} />
                </div>

                {docFacts.map((f, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 14, padding: '9px 0', borderBottom: '1px solid #eeece7' }}>
                    <span style={{ flex: 'none', width: 88, fontSize: 12, color: '#6f6b63', paddingTop: 2 }}>{f.k}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{f.v}</span>
                  </div>
                ))}

                <div style={{ fontSize: 12, color: '#6f6b63', margin: '18px 0 6px' }}>{t.evAttached}</div>
                {docEvid.map((ev, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid #f2f1ec' }}>
                    <span style={{ fontWeight: 700 }}>{ev.tag}</span>
                    <span style={{ flex: 1, color: '#4a4740' }}>{ev.label}</span>
                    <span style={{ color: '#1b5e3f', fontVariantNumeric: 'tabular-nums' }}>{ev.meta}</span>
                  </div>
                ))}

                <p style={{ fontSize: 13, lineHeight: 1.65, color: '#6f6b63', margin: '18px 0 0' }}>{t.declaration}</p>

                <div style={{ display: 'flex', gap: 20, marginTop: 36 }}>
                  <div style={{ flex: 1, borderTop: '1px solid #1c1c1a', paddingTop: 6, fontSize: 11, color: '#6f6b63' }}>{t.sign}</div>
                  <div style={{ flex: 1, borderTop: '1px solid #1c1c1a', paddingTop: 6, fontSize: 11, color: '#6f6b63' }}>{t.date}</div>
                </div>

                <div style={{ borderTop: '1px solid #e5e3de', marginTop: 20, paddingTop: 10, fontSize: 10.5, color: '#9a968d', lineHeight: 1.7 }}>
                  {L('ಮೂಲ', 'Source') + ' — ' + ac.src + ' · ' + L('ಪರಿಶೀಲನೆ', 'Verified') + ' ' + ac.verified}
                  <br />
                  {t.docFooter2}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => {
                    generatePdfAndDownload(ac)
                    setShareFlash(true)
                    setTimeout(() => setShareFlash(false), 2200)
                  }}
                  style={{
                    flex: 2,
                    minHeight: 56,
                    background: '#1c1c1a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {shareFlash ? t.docDownloaded : t.docDownload}
                </button>
                 <button
                  onClick={() => {
                    setShowSuccessToast(true)
                    setTimeout(() => {
                      setShowSuccessToast(false)
                      setScreen('home')
                    }, 2200)
                  }}
                  style={{ flex: 1, minHeight: 56, background: '#ffffff', border: '1px solid #d9d6cf', borderRadius: 999, fontSize: 15, fontWeight: 700 }}
                >
                  {t.caseBtn}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
