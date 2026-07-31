'use client'

import { useState, useEffect, useRef } from 'react'

import { listCases, submitAudio, setStepDone, uploadPhoto, fetchDocument } from '@/lib/api'
import { adaptCases, adaptCase, adaptIntake } from '@/lib/adapt'

const H = 3600e3 // 1 hour in ms

const STAMP_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "30 JUL 2026" - burned into the photo alongside the time. */
const shortStamp = (d) =>
  `${String(d.getDate()).padStart(2, '0')} ${STAMP_MONTHS[d.getMonth()]} ${d.getFullYear()}`

export default function Home() {
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
  const [screen, setScreen] = useState('first_run') // 'first_run' | 'confirm_doc' | 'home' | 'intake' | 'case' | 'capture' | 'doc'
  const [caseId, setCaseId] = useState(null)
  // Starts at 0, not Date.now(): reading the clock during render makes the
  // server and client markup differ, which is a hydration mismatch. The timer
  // effect below sets the real value on mount.
  const [now, setNow] = useState(0)

  // Onboarding & Completeness State
  const [completeness, setCompleteness] = useState(0) // 0 to 1
  const [showHomeNudge, setShowHomeNudge] = useState(true)
  const [docType, setDocType] = useState('policy') // 'policy' | 'passbook'
  const [docFields, setDocFields] = useState({
    policyNo: 'PMFBY/2026/894120',
    surveyNo: '142/2A',
    area: '2.5',
    accountNo: '39410291048',
    ifsc: 'SBIN0001422',
  })

  // Intake states
  const [intake, setIntake] = useState('idle') // 'idle' | 'recording' | 'processing' | 'clarify'
  const [recSec, setRecSec] = useState(0)
  // What the backend actually extracted, via adaptIntake(). Null until a clip
  // has been transcribed.
  const [intakeResult, setIntakeResult] = useState(null)
  const [intakeError, setIntakeError] = useState(null)
  const [stepError, setStepError] = useState(null)
  const audioRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioStreamRef = useRef(null)

  // Capture states
  const [capCase, setCapCase] = useState(null)
  const [capIdx, setCapIdx] = useState(null)
  const [captured, setCaptured] = useState(false)
  const [capFrozen, setCapFrozen] = useState(null)
  const [capPreview, setCapPreview] = useState(null) // object URL of the frame just taken
  const [capUploading, setCapUploading] = useState(false)
  const [capError, setCapError] = useState(null)
  const canvasRef = useRef(null)
  const capBlobRef = useRef(null)
  const capTakenAtRef = useRef(null)

  // Scroll preservation for Evidence Checklist
  const s3SectionRef = useRef(null)
  const checklistRef = useRef(null)
  const savedChecklistScrollRef = useRef(350)

  // Document states
  const [docReady, setDocReady] = useState(true)
  const [shareFlash, setShareFlash] = useState(false)
  const [docUrl, setDocUrl] = useState(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState(null)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Date Confirmation Modal State
  const [showDateModal, setShowDateModal] = useState(false)
  const [dateModalCase, setDateModalCase] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState('08:00')

  const openDateModal = (c, e) => {
    if (e) e.stopPropagation()
    setDateModalCase(c)
    const todayStr = new Date().toISOString().split('T')[0]
    setSelectedDate(todayStr)
    setSelectedTime('08:00')
    setShowDateModal(true)
  }

  const formatShortDate = (iso) => {
    if (!iso) return ''
    const x = new Date(iso)
    if (Number.isNaN(x.getTime())) return ''
    const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    return `${pad(x.getDate())} ${M[x.getMonth()]} ${x.getFullYear()}`
  }

  const handleConfirmDateSave = () => {
    if (!dateModalCase) return
    const targetId = dateModalCase.id
    const dateTimeStr = `${selectedDate}T${selectedTime}:00`
    const eventTime = new Date(dateTimeStr).getTime()
    const validEventTime = Number.isNaN(eventTime) ? Date.now() : eventTime
    const windowHours = dateModalCase.windowH || 72
    const deadlineTime = validEventTime + windowHours * 3600 * 1000
    const deadlineIso = new Date(deadlineTime).toISOString()

    setCases((prevCases) =>
      prevCases.map((c) => {
        if (c.id === targetId) {
          const isoStr = new Date(validEventTime).toISOString()
          return {
            ...c,
            deadline: deadlineTime,
            deadlineIso: deadlineIso,
            hoursRemaining: windowHours,
            status: 'open',
            st: 'open',
            eventDate: formatShortDate(isoStr),
            eventDateEn: formatShortDate(isoStr),
            event: {
              ...c.event,
              event_datetime: isoStr,
              event_datetime_raw: dateTimeStr,
            },
          }
        }
        return c
      })
    )

    setShowDateModal(false)
    setDateModalCase(null)
    setToastMessage(L('ದಿನಾಂಕ ಧೃಡೀಕರಿಸಲಾಗಿದೆ! ಗಡಿಯಾರ ಪ್ರಾರಂಭವಾಗಿದೆ.', 'Date confirmed! Countdown started.'))
    setShowSuccessToast(true)
    setTimeout(() => {
      setShowSuccessToast(false)
    }, 3500)
  }

  // Dynamic Geolocation State.
  //
  // lat/lon stay null until the device actually returns a fix. They are what
  // gets uploaded, and stamped into the photo. Never substitute a placeholder
  // here: a coordinate burned onto claim evidence has to be the real one or
  // absent, and the backend marks a photo location_verified: false when it
  // arrives without one.
  const [geoCoords, setGeoCoords] = useState({
    str: '',
    shortStr: '',
    lat: null,
    lon: null,
    accuracy: null,
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator && screen === 'capture') {
      // Asked at capture time, not on page load - permission prompts land when
      // the person is trying to take the photo, which is when they make sense.
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
          setGeoCoords({ str, shortStr, lat: latVal, lon: lngVal, accuracy: accVal })
        },
        // Denied or unavailable. The capture still goes ahead, unstamped.
        () => setGeoCoords({ str: '', shortStr: '', lat: null, lon: null, accuracy: null }),
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
  const [casesLoading, setCasesLoading] = useState(true)
  const [casesError, setCasesError] = useState(null)
  // Bumped by the retry button to re-run the fetch below.
  const [casesReload, setCasesReload] = useState(0)

  useEffect(() => {
    let alive = true
    setCasesLoading(true)
    setCasesError(null)
    listCases()
      .then((data) => {
        if (!alive) return
        setCases(adaptCases(data, lang))
        setCasesLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        // Never fall through to the empty state on failure - "no cases yet"
        // and "the backend is down" must not look identical.
        setCasesError(err?.message || 'Could not reach the server')
        setCasesLoading(false)
      })
    return () => {
      alive = false
    }
  }, [lang, casesReload])

  useEffect(() => {
    if (screen === 'case' && s3SectionRef.current) {
      const targetScroll = savedChecklistScrollRef.current > 0 ? savedChecklistScrollRef.current : 350
      s3SectionRef.current.scrollTop = targetScroll
    }
  }, [screen, cases])

  // Timer loop
  useEffect(() => {
    // Set immediately so countdowns are correct on the first painted frame,
    // not one second later.
    setNow(Date.now())
    const iv = setInterval(() => {
      setNow(Date.now())
      if (intake === 'recording') {
        setRecSec((prev) => prev + 1)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [intake])

  // Never leave the microphone open after this screen goes away.
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
        audioStreamRef.current = null
      }
    }
  }, [])

  // Object URLs for the captured frame are not garbage collected on their own.
  useEffect(() => {
    return () => {
      if (capPreview) URL.revokeObjectURL(capPreview)
    }
  }, [capPreview])

  // Same for the generated PDF.
  useEffect(() => {
    return () => {
      if (docUrl) URL.revokeObjectURL(docUrl)
    }
  }, [docUrl])

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
    if (ms == null) return '--:--'
    if (ms <= 0) return '00:00'
    const h = Math.floor(ms / H)
    const m = Math.floor((ms % H) / 60e3)
    return `${pad(h)}:${pad(m)}`
  }
  const due = (d) => {
    if (!d) return L('ದಿನಾಂಕ ಬೇಕಾಗಿದೆ', 'Date required')
    const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return L('ದಿನಾಂಕ ಬೇಕಾಗಿದೆ', 'Date required')
    return `${pad(x.getDate())} ${M[x.getMonth()]} ${pad(x.getHours())}:${pad(x.getMinutes())}`
  }
  const clock = (d) => {
    if (!d) return '--:--:--'
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return '--:--:--'
    return `${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`
  }

  const getStatus = (rem) => (rem == null ? 'need_info' : rem <= 0 ? 'expired' : rem < 12 * H ? 'soon' : 'open')
  const getCol = (st) => ({ open: '#1b5e3f', soon: '#a05a00', expired: '#6f6b63', need_info: '#b45309' }[st] || '#b45309')
  const getChip = (st) => ({ open: '#e8f2ec', soon: '#fdf3e4', expired: '#f1f0ec', need_info: '#fef3c7' }[st] || '#fef3c7')
  const getBadge = (st) =>
    isKn
      ? ({ open: 'ಚಾಲ್ತಿ', soon: 'ಶೀಘ್ರ ಮುಕ್ತಾಯ', expired: 'ಅವಧಿ ಮೀರಿದೆ', need_info: 'ದಿನಾಂಕ ಬೇಕಾಗಿದೆ' }[st] || 'ದಿನಾಂಕ ಬೇಕಾಗಿದೆ')
      : ({ open: 'Open', soon: 'Closing soon', expired: 'Expired', need_info: 'Date required' }[st] || 'Date required')

  const cloneCases = () => cases.map((c) => ({ ...c, steps: c.steps.map((s) => ({ ...s })) }))

  /**
   * Tick a checklist step. Updates on screen immediately and persists in the
   * background - a tap that waits on the network feels broken on a slow phone.
   * If the PATCH fails the tick is rolled back and the reason surfaced, so the
   * screen never claims something is saved when it is not.
   */
  const toggleStep = async (id, i) => {
    const targetCase = cases.find((c) => c.id === id)
    const step = targetCase?.steps[i]
    if (!targetCase || !step || step.photo) return

    const nextDone = !step.done
    const previous = cases
    setCases(
      cases.map((c) =>
        c.id === id ? { ...c, steps: c.steps.map((s, idx) => (idx === i ? { ...s, done: nextDone } : s)) } : c
      )
    )
    setStepError(null)

    try {
      const updated = await setStepDone(id, step.id, nextDone)
      // Trust the server's version of the case over the optimistic one.
      const adapted = adaptCase(updated, lang)
      setCases((current) => current.map((c) => (c.id === id ? adapted : c)))
    } catch (err) {
      setCases(previous)
      setStepError(err?.message || 'Could not save that step')
    }
  }

  // Release the microphone. Called on stop, on unmount, and on any failure -
  // a live mic indicator left burning after the screen closes is unacceptable.
  const releaseMic = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }
    audioRecorderRef.current = null
  }

  const handleStartRec = async () => {
    setIntakeError(null)
    setIntakeResult(null)

    // navigator.mediaDevices is undefined on insecure origins. Checking
    // explicitly turns a confusing exception into a message naming the fix.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setIntakeError(t.micInsecure)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioStreamRef.current = stream
      audioRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data?.size) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        releaseMic()
        try {
          // Pass lang explicitly. Without it the backend auto-detects, and an
          // English speaker can get Kannada content back despite the toggle.
          const response = await submitAudio(blob, lang)
          setIntakeResult(adaptIntake(response, lang))
          setIntake('clarify')
        } catch (err) {
          setIntakeError(err?.message || 'Could not process the recording')
          setIntake('idle')
        }
      }

      recorder.start()
      setIntake('recording')
      setRecSec(0)
    } catch {
      releaseMic()
      setIntakeError(t.micBlocked)
      setIntake('idle')
    }
  }

  const handleStopRec = () => {
    setIntake('processing')
    if (audioRecorderRef.current?.state === 'recording') {
      // onstop does the upload; it also releases the mic.
      audioRecorderRef.current.stop()
    } else {
      releaseMic()
      setIntake('idle')
    }
  }

  /**
   * Take the frame. Draws the live video at its own resolution, burns the
   * location and time into the corner, and keeps the JPEG for upload.
   *
   * The stamp is drawn into the pixels rather than laid over them in the DOM,
   * because the photo has to carry its own provenance once it leaves the app.
   */
  const handleShutter = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    setCapError(null)

    if (!video || !canvas || !video.videoWidth) {
      setCapError(t.cameraUnavailable)
      return
    }

    const takenAt = new Date()
    const width = video.videoWidth
    const height = video.videoHeight
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, width, height)

    // Stamp. Scaled off the frame width so it is legible at any resolution.
    const fontSize = Math.max(16, Math.round(width * 0.028))
    const padding = Math.round(fontSize * 0.75)
    const line1 = geoCoords.str || t.noLocation
    const line2 = `${pad(takenAt.getHours())}:${pad(takenAt.getMinutes())}:${pad(takenAt.getSeconds())} IST · ${shortStamp(takenAt)}`

    ctx.font = `600 ${fontSize}px system-ui, sans-serif`
    const boxWidth = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + padding * 2
    const boxHeight = fontSize * 2 + padding * 2.4
    ctx.fillStyle = 'rgba(28,28,26,0.6)'
    ctx.fillRect(padding, height - boxHeight - padding, boxWidth, boxHeight)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(line1, padding * 2, height - boxHeight - padding + fontSize + padding * 0.6)
    ctx.fillText(line2, padding * 2, height - boxHeight - padding + fontSize * 2 + padding)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCapError(t.captureFailed)
          return
        }
        capBlobRef.current = blob
        capTakenAtRef.current = takenAt.toISOString()
        if (capPreview) URL.revokeObjectURL(capPreview)
        setCapPreview(URL.createObjectURL(blob))
        setCaptured(true)
        setCapFrozen(clock(takenAt.getTime()))
      },
      'image/jpeg',
      0.85
    )
  }

  const clearCapture = () => {
    if (capPreview) URL.revokeObjectURL(capPreview)
    setCapPreview(null)
    capBlobRef.current = null
    capTakenAtRef.current = null
    setCaptured(false)
    setCapFrozen(null)
  }

  /** Upload the frame, then take the server's version of the case as truth. */
  const handleAttachPhoto = async () => {
    if (!capBlobRef.current || !capCase) return
    setCapUploading(true)
    setCapError(null)
    const stepId = cases.find((c) => c.id === capCase)?.steps[capIdx]?.id

    try {
      await uploadPhoto(capCase, capBlobRef.current, {
        // Null when permission was denied. The backend then records the photo
        // with location_verified: false rather than rejecting it.
        lat: geoCoords.lat,
        lon: geoCoords.lon,
        accuracy: geoCoords.accuracy,
        capturedAt: capTakenAtRef.current,
        stepId,
      })
      setCasesReload((n) => n + 1)
      clearCapture()
      setCaseId(capCase)
      setScreen('case')
    } catch (err) {
      setCapError(err?.message || 'Could not upload the photo')
    } finally {
      setCapUploading(false)
    }
  }

  /**
   * The backend already created the Case during POST /api/intake, so there is
   * nothing to fabricate here - just re-read the list and open it.
   */
  const goToIntakeCase = async () => {
    const newId = intakeResult?.caseId
    setIntake('idle')
    setIntakeResult(null)
    if (!newId) {
      // No case means the model could not classify the event, and there is no
      // endpoint to submit a clarification against. Ask for another recording.
      setScreen('intake')
      return
    }
    setCasesReload((n) => n + 1)
    setCaseId(newId)
    setScreen('case')
  }

  // Prepared data
  const cs = cases.map((c) => {
    const hasDeadline = !!c.deadlineIso && c.deadline != null
    const rem = hasDeadline ? c.deadline - now : null
    const st = !hasDeadline ? 'need_info' : getStatus(rem)
    return {
      ...c,
      rem,
      st,
      color: getCol(st),
      chipBg: getChip(st),
      pct: rem != null ? Math.max(0, Math.min(100, (1 - rem / (c.windowH * H)) * 100)) : 0,
    }
  })

  const live = cs.filter((c) => c.st !== 'expired').sort((a, b) => (a.rem ?? Infinity) - (b.rem ?? Infinity))
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
  // Derived from the ticking `now` state, never Date.now() during render.
  const stampDate = shortStamp(new Date(now))

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
    loadingCases: L('ಪ್ರಕರಣಗಳನ್ನು ತರಲಾಗುತ್ತಿದೆ…', 'Loading cases…'),
    casesErrorTitle: L('ಪ್ರಕರಣಗಳನ್ನು ತರಲು ಆಗಲಿಲ್ಲ', 'Could not load cases'),
    retry: L('ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', 'Retry'),
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
    clarifyConfirmSub: L('ಸರಿಯಾಗಿದ್ದರೆ ಮುಂದುವರಿಯಿರಿ', 'Continue if this is correct'),
    stepSaveFailed: L('ಉಳಿಸಲು ಆಗಲಿಲ್ಲ —', 'Could not save —'),
    noLocation: L('ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ', 'Location unavailable'),
    cameraUnavailable: L(
      'ಕ್ಯಾಮೆರಾ ಸಿದ್ಧವಾಗಿಲ್ಲ. ಈ ಪುಟ HTTPS ಅಥವಾ localhost ನಲ್ಲಿ ತೆರೆಯಬೇಕು.',
      'Camera not ready — this page must be served over HTTPS or localhost.'
    ),
    captureFailed: L('ಫೋಟೋ ತೆಗೆಯಲು ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', 'Could not capture the frame. Try again.'),
    attaching: L('ಸೇರಿಸಲಾಗುತ್ತಿದೆ…', 'Attaching…'),
    docGenerating: L('ತಯಾರಿಸಲಾಗುತ್ತಿದೆ…', 'Generating…'),
    docMockUnavailable: L(
      'ಮಾಕ್ ಮೋಡ್‌ನಲ್ಲಿ PDF ಲಭ್ಯವಿಲ್ಲ. ನಿಜವಾದ ಬ್ಯಾಕೆಂಡ್ ಚಾಲನೆಯಲ್ಲಿರಬೇಕು.',
      'PDF unavailable in mock mode — run the real backend to generate it.'
    ),
    clarifyContinue: L('ಸರಿ, ಮುಂದುವರಿಯಿರಿ', 'Yes, continue'),
    micInsecure: L(
      'ಮೈಕ್ ಸಿಗಲಿಲ್ಲ. ಈ ಪುಟ HTTPS ಅಥವಾ localhost ನಲ್ಲಿ ತೆರೆಯಬೇಕು.',
      'Microphone unavailable — this page must be served over HTTPS or localhost.'
    ),
    micBlocked: L(
      'ಮೈಕ್ ಸಿಗಲಿಲ್ಲ. ಅನುಮತಿ ಪರಿಶೀಲಿಸಿ, ಮತ್ತು ಪುಟ HTTPS ಅಥವಾ localhost ನಲ್ಲಿದೆಯೇ ನೋಡಿ.',
      'Microphone blocked — check permissions, and that this page is HTTPS or localhost.'
    ),
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
    s0Heading: L('ವಿಮೆ ಪತ್ರ ಅಥವಾ ಪಾಸ್‌ಬುಕ್ ಸೇರಿಸಿ', 'Add your policy or passbook'),
    s0Sub: L('ವರದಿ ಮಾಡುವ ಪ್ರಕ್ರಿಯೆಯನ್ನು 30 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಪೂರ್ಣಗೊಳಿಸಿ', 'Speed up future damage intimations to under 30 seconds'),
    scanPolicy: L('ವಿಮೆ ಪತ್ರ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ', 'Scan policy certificate'),
    scanPolicySub: L('PMFBY, ಬೆಳೆ ವಿಮೆ ರಸೀದಿ, ಸಂಸ್ಥೆಯ ಮಾಹಿತಿ', 'PMFBY policy, premium receipt & crop details'),
    scanPassbook: L('ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ', 'Scan bank passbook'),
    scanPassbookSub: L('ಖಾತೆ ಸಂಖ್ಯೆ, IFSC, ಶಾಖೆಯ ವಿವರಗಳು', 'Account number, IFSC & branch details'),
    skipToReport: L('ಈಗ ಬೇಡ — ಹಾನಿ ವರದಿ ಮಾಡಬೇಕು', 'Skip — I need to report damage now'),
    firstRunFooter: L('ಈ ಸಾಧನದಲ್ಲಿ ಮಾತ್ರ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ · ಆಧಾರ್ ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ', 'Stored on this device only · Aadhaar is never collected'),
    s0bTitle: L('ಪರಿಶೀಲಿಸಿ ಧೃಡೀಕರಿಸಿ', 'Confirm document details'),
    s0bSub: L('Gemma ಓದಿದ ಮಾಹಿತಿ. ಅಗತ್ಯವಿದ್ದರೆ ಹಳದಿ ಬಾಕ್ಸ್ ಮೇಲೊತ್ತಿ ಬದಲಾಯಿಸಿ.', 'Gemma extracted these fields. Tap amber boxes to edit before persisting.'),
    confirmSave: L('ಪರಿಶೀಲಿಸಿ ಉಳಿಸಿ', 'Confirm and save'),
    homeNudge: L('ನಿಮ್ಮ ವಿಮೆ ಪತ್ರ ಸೇರಿಸಿ — ಮುಂದಿನ ಬಾರಿ ವರದಿ ಮಾಡಲು 30 ಸೆಕೆಂಡ್ ಸಾಕು', 'Add your policy certificate — reporting will take 30 seconds next time'),
  }

  /**
   * Fetch the document the backend generates. The UI used to assemble raw
   * %PDF-1.4 bytes by hand, which meant two divergent definitions of the same
   * legal form - and only the server's one is derived from the rule files.
   *
   * fetchDocument returns an object URL, or null under NEXT_PUBLIC_USE_MOCKS
   * because there is no real PDF to hand back.
   */
  const handleGenerateDoc = async (targetCase) => {
    if (!targetCase || docLoading) return
    setDocLoading(true)
    setDocError(null)
    try {
      const url = await fetchDocument(targetCase.ruleId || targetCase.rule, targetCase.event)
      if (!url) {
        // Mock mode. Say so rather than opening about:blank.
        setDocError(t.docMockUnavailable)
        return
      }
      if (docUrl) URL.revokeObjectURL(docUrl)
      setDocUrl(url)
      const a = document.createElement('a')
      a.href = url
      a.download = `${targetCase.id}_loss_intimation.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setShareFlash(true)
      setTimeout(() => setShareFlash(false), 2200)
    } catch (err) {
      setDocError(err?.message || 'Could not generate the document')
    } finally {
      setDocLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', height: '100vh', background: '#f8f7f3', color: '#1c1c1a', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          {toastMessage || L('ಯಶಸ್ವಿಯಾಗಿ ನೋಂದಾಯಿಸಲಾಗಿದೆ!', 'Registered successfully!')}
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

      {/* S0 First Run Screen */}
      {screen === 'first_run' && (
        <section data-screen-label="S0 First Run" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e3f' }}>{L('ಆನ್ ಬೋರ್ಡಿಂಗ್', 'Onboarding')}</span>
            <span style={{ fontSize: 12, color: '#6f6b63' }}>{completeness === 0 ? L('ಹೊಸ ಬಳಕೆದಾರ', 'New user') : L('ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ', 'Complete profile')}</span>
          </header>

          <div style={{ marginTop: 12 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.25 }}>{t.s0Heading}</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: '#4a4740', margin: '8px 0 0' }}>{t.s0Sub}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {/* Card 1: Scan policy certificate */}
            <div
              onClick={() => {
                setDocType('policy')
                setScreen('confirm_doc')
              }}
              style={{
                background: '#ffffff',
                border: '1.5px solid #d9d6cf',
                borderRadius: 16,
                padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0ede6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flex: 'none' }}>
                📄
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1a' }}>{t.scanPolicy}</div>
                <div style={{ fontSize: 12, color: '#6f6b63', marginTop: 2, lineHeight: 1.35 }}>{t.scanPolicySub}</div>
              </div>
            </div>

            {/* Card 2: Scan bank passbook */}
            <div
              onClick={() => {
                setDocType('passbook')
                setScreen('confirm_doc')
              }}
              style={{
                background: '#ffffff',
                border: '1.5px solid #d9d6cf',
                borderRadius: 16,
                padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eaf3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flex: 'none' }}>
                🏦
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1a' }}>{t.scanPassbook}</div>
                <div style={{ fontSize: 12, color: '#6f6b63', marginTop: 2, lineHeight: 1.35 }}>{t.scanPassbookSub}</div>
              </div>
            </div>
          </div>

          {/* Third, visually primary action (the most prominent element on screen) */}
          <button
            onClick={() => setScreen('intake')}
            style={{
              width: '100%',
              minHeight: 62,
              background: '#1c1c1a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 999,
              fontSize: 16,
              fontWeight: 700,
              marginTop: 18,
              boxShadow: '0 4px 16px rgba(28,28,26,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>{t.skipToReport}</span>
          </button>

          {/* Footer line */}
          <div
            style={{
              fontSize: 12,
              color: '#1b5e3f',
              fontWeight: 600,
              textAlign: 'center',
              marginTop: 14,
              marginBottom: 8,
              lineHeight: 1.5,
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
            {t.firstRunFooter}
          </div>
        </section>
      )}

      {/* S0b Confirm Details Screen */}
      {screen === 'confirm_doc' && (
        <section data-screen-label="S0b Confirm Doc" style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px', display: 'flex', flexDirection: 'column' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setScreen('first_run')}
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
              }}
            >
              {t.back}
            </button>
            <span style={{ fontSize: 12, color: '#6f6b63' }}>{docType === 'policy' ? L('ವಿಮೆ ಪತ್ರ OCR', 'Policy OCR') : L('ಪಾಸ್‌ಬುಕ್ OCR', 'Passbook OCR')}</span>
          </header>

          <div style={{ marginTop: 18 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.25 }}>{t.s0bTitle}</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: '#4a4740', margin: '8px 0 0' }}>{t.s0bSub}</p>
          </div>

          {/* Small Confirmed Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 600, background: '#eaf3ee', color: '#1b5e3f', borderRadius: 999, padding: '5px 12px', border: '1px solid #b7e0ca' }}>
              ✓ Insurer: PMFBY (96%)
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, background: '#eaf3ee', color: '#1b5e3f', borderRadius: 999, padding: '5px 12px', border: '1px solid #b7e0ca' }}>
              ✓ Crop: Cotton (98%)
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, background: '#eaf3ee', color: '#1b5e3f', borderRadius: 999, padding: '5px 12px', border: '1px solid #b7e0ca' }}>
              ✓ Season: Kharif 2026 (95%)
            </span>
          </div>

          {/* Needs Confirmation Fields - Large Monospace, Amber Bordered, Confidence Shown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
            {docType === 'policy' ? (
              <>
                <div style={{ background: '#fffbeb', border: '2px solid #d97706', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                    <span>{L('ವಿಮೆ ಪಾಲಿಸಿ ಸಂಖ್ಯೆ', 'Policy Number')}</span>
                    <span>{L('ವಿಶ್ವಾಸಾರ್ಹತೆ 88%', '88% confidence')}</span>
                  </div>
                  <input
                    type="text"
                    value={docFields.policyNo}
                    onChange={(e) => setDocFields({ ...docFields, policyNo: e.target.value })}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 19, fontWeight: 700, border: 'none', background: 'transparent', color: '#1c1c1a', outline: 'none' }}
                  />
                </div>

                <div style={{ background: '#fffbeb', border: '2px solid #d97706', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                    <span>{L('ಸರ್ವೆ ಸಂಖ್ಯೆ', 'Survey Number')}</span>
                    <span>{L('ವಿಶ್ವಾಸಾರ್ಹತೆ 82%', '82% confidence')}</span>
                  </div>
                  <input
                    type="text"
                    value={docFields.surveyNo}
                    onChange={(e) => setDocFields({ ...docFields, surveyNo: e.target.value })}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 19, fontWeight: 700, border: 'none', background: 'transparent', color: '#1c1c1a', outline: 'none' }}
                  />
                </div>

                <div style={{ background: '#fffbeb', border: '2px solid #d97706', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                    <span>{L('ವಿಸ್ತೀರ್ಣ (ಎಕರೆ)', 'Insured Area (Acres)')}</span>
                    <span>{L('ವಿಶ್ವಾಸಾರ್ಹತೆ 91%', '91% confidence')}</span>
                  </div>
                  <input
                    type="text"
                    value={docFields.area}
                    onChange={(e) => setDocFields({ ...docFields, area: e.target.value })}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 19, fontWeight: 700, border: 'none', background: 'transparent', color: '#1c1c1a', outline: 'none' }}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ background: '#fffbeb', border: '2px solid #d97706', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                    <span>{L('ಬ್ಯಾಂಕ್ ಖಾತೆ ಸಂಖ್ಯೆ', 'Account Number')}</span>
                    <span>{L('ವಿಶ್ವಾಸಾರ್ಹತೆ 85%', '85% confidence')}</span>
                  </div>
                  <input
                    type="text"
                    value={docFields.accountNo}
                    onChange={(e) => setDocFields({ ...docFields, accountNo: e.target.value })}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 19, fontWeight: 700, border: 'none', background: 'transparent', color: '#1c1c1a', outline: 'none' }}
                  />
                </div>

                <div style={{ background: '#fffbeb', border: '2px solid #d97706', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                    <span>{L('IFSC ಕೋಡ್', 'IFSC Code')}</span>
                    <span>{L('ವಿಶ್ವಾಸಾರ್ಹತೆ 94%', '94% confidence')}</span>
                  </div>
                  <input
                    type="text"
                    value={docFields.ifsc}
                    onChange={(e) => setDocFields({ ...docFields, ifsc: e.target.value })}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 19, fontWeight: 700, border: 'none', background: 'transparent', color: '#1c1c1a', outline: 'none' }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Confirm and save button */}
          <button
            onClick={() => {
              setCompleteness(1)
              setShowSuccessToast(true)
              setTimeout(() => {
                setShowSuccessToast(false)
                setScreen('home')
              }, 2000)
            }}
            style={{
              width: '100%',
              minHeight: 64,
              background: '#1b5e3f',
              color: '#ffffff',
              border: 'none',
              borderRadius: 999,
              fontSize: 16.5,
              fontWeight: 700,
              marginTop: 26,
              cursor: 'pointer',
            }}
          >
            {t.confirmSave}
          </button>
        </section>
      )}

      {/* S1 Home Screen */}
      {screen === 'home' && (
        <section data-screen-label="S1 Home" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 140px' }}>

          {completeness < 1 && showHomeNudge && (
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div
                onClick={() => setScreen('first_run')}
                style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>📄</span>
                <span>{t.homeNudge}</span>
              </div>
              <button
                onClick={() => setShowHomeNudge(false)}
                style={{ background: 'none', border: 'none', color: '#b45309', fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '0 4px' }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ fontSize: 16, fontWeight: 600, color: '#4a4740', margin: '22px 0 12px' }}>
            {casesLoading || casesError
              ? L('ಪ್ರಕರಣಗಳು', 'Cases')
              : (empty ? 0 : cs.length) + ' ' + L('ಪ್ರಕರಣ ದಾಖಲೆಯಲ್ಲಿ', 'cases on record')}
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

          {casesLoading && (
            <div style={{ background: '#fafaf8', border: '1px solid #e9e7e2', borderRadius: 16, padding: '40px 24px', textAlign: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 15, color: '#6f6b63', lineHeight: 1.6 }}>{t.loadingCases}</div>
            </div>
          )}

          {!casesLoading && casesError && (
            <div style={{ background: '#fdf3e4', border: '1px solid #ecd9b8', borderRadius: 16, padding: '28px 24px', textAlign: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#5c3400' }}>{t.casesErrorTitle}</div>
              <div style={{ fontSize: 14, color: '#8a5a10', marginTop: 8, lineHeight: 1.6 }}>{casesError}</div>
              <button
                onClick={() => setCasesReload((n) => n + 1)}
                style={{
                  marginTop: 18,
                  minHeight: 48,
                  padding: '0 26px',
                  background: '#1c1c1a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {t.retry}
              </button>
            </div>
          )}

          {!casesLoading && !casesError && empty && (
            <div style={{ background: '#fafaf8', border: '1px solid #e9e7e2', borderRadius: 16, padding: '40px 24px', textAlign: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t.emptyTitle}</div>
              <div style={{ fontSize: 15, color: '#6f6b63', marginTop: 8, lineHeight: 1.6 }}>{t.emptyBody}</div>
            </div>
          )}

          {!casesLoading && !casesError && !empty &&
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
                  {!c.deadlineIso || c.st === 'need_info' ? (
                    <div
                      onClick={(e) => openDateModal(c, e)}
                      style={{
                        marginTop: 12,
                        background: '#fdf3e4',
                        border: '1.5px solid #ecd9b8',
                        borderRadius: 12,
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#b45309" strokeWidth="2" style={{ flex: 'none' }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#5c3400' }}>
                            {L('ಘಟನೆಯ ದಿನಾಂಕವನ್ನು ಧೃಡೀಕರಿಸಿ', 'Confirm event date')}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#8a5a10', marginTop: 1 }}>
                            {L('ಗಡಿಯಾರ ಪ್ರಾರಂಭಿಸಲು ದಿನಾಂಕ ಬೇಕಾಗಿದೆ', 'Date required to start countdown')}
                          </div>
                        </div>
                      </div>
                      <span
                        onClick={(e) => openDateModal(c, e)}
                        style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#ffffff', border: '1px solid #ecd9b8', padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer' }}
                      >
                        {L('ದಿನಾಂಕ ನಮೂದಿಸಿ', 'Set Date & Time')}
                      </span>
                    </div>
                  ) : (
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
                  )}
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
              {intakeError && (
                <div
                  style={{
                    background: '#fdf3e4',
                    border: '1px solid #ecd9b8',
                    borderRadius: 14,
                    padding: '14px 16px',
                    marginBottom: 16,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: '#5c3400',
                  }}
                >
                  {intakeError}
                </div>
              )}
              <button
                onClick={handleStartRec}
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

          {intake === 'clarify' && intakeResult && (
            <div style={{ paddingTop: 16, marginBottom: 20 }}>
              <div style={{ background: '#fafaf8', border: '1px solid #e9e7e2', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4a4740', marginBottom: 8 }}>{t.factsLabel}</div>
                {[
                  { k: t.factCrop, v: intakeResult.facts.crop },
                  { k: t.factWhen, v: intakeResult.facts.when },
                  { k: t.factArea, v: intakeResult.facts.area },
                ]
                  // Only show what the model actually extracted. A blank row
                  // reads as "we know this and it is empty", which is worse.
                  .filter((row) => row.v)
                  .map((row, idx) => (
                    <div
                      key={idx}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '7px 0', borderTop: '1px solid #eeece7' }}
                    >
                      <span style={{ color: '#6f6b63' }}>{row.k}</span>
                      <span style={{ fontWeight: 700 }}>{row.v}</span>
                    </div>
                  ))}
              </div>

              {intakeResult.transcript && (
                <div style={{ fontSize: 13, color: '#6f6b63', marginTop: 12, lineHeight: 1.6 }}>“{intakeResult.transcript}”</div>
              )}

              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '26px 0 4px', lineHeight: 1.35 }}>
                {intakeResult.question || t.clarifyQ}
              </h2>
              <div style={{ fontSize: 13, color: '#6f6b63', marginBottom: 16 }}>
                {intakeResult.options.length > 0 ? t.clarifySub : t.clarifyConfirmSub}
              </div>

              {intakeResult.options.length > 0
                ? intakeResult.options.map((o, idx) => (
                    <button
                      key={idx}
                      onClick={goToIntakeCase}
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
                      <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{o}</span>
                    </button>
                  ))
                : (
                  <button
                    onClick={goToIntakeCase}
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
                    <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{t.clarifyContinue}</span>
                  </button>
                )}
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

            {!ac.deadlineIso || ac.st === 'need_info' ? (
              <div
                style={{
                  marginTop: 14,
                  background: '#fdf3e4',
                  border: '1px solid #ecd9b8',
                  borderRadius: 14,
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#b45309" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#5c3400', lineHeight: 1.3 }}>
                      {L('ಘಟನೆಯ ದಿನಾಂಕವನ್ನು ಧೃಡೀಕರಿಸಿ', 'Confirm event date')}
                    </div>
                    <div style={{ fontSize: 13, color: '#8a5a10', marginTop: 4, lineHeight: 1.5 }}>
                      {L(
                        'ಘಟನೆ ನಡೆದ ದಿನಾಂಕ ಅಥವಾ ಬ್ಯಾಂಕ್ ಸೂಚನೆ ದಿನಾಂಕ ಸ್ಪಷ್ಟವಾಗಿ ತಿಳಿದ ನಂತರ ಗಡುವು ಲೆಕ್ಕಾಚಾರ ಮಾಡಲಾಗುತ್ತದೆ.',
                        'The deadline countdown will be calculated once the exact event date or bank notice date is confirmed.'
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => openDateModal(ac, e)}
                  style={{
                    width: '100%',
                    marginTop: 14,
                    padding: '12px 16px',
                    background: '#b45309',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  {L('ದಿನಾಂಕ ನಮೂದಿಸಿ / ಧೃಡೀಕರಿಸಿ', 'Provide / confirm date')}
                </button>
              </div>
            ) : (
              <>
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
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eeece7', marginTop: 16, paddingTop: 11, fontSize: 13 }}>
              <span style={{ color: '#6f6b63' }}>{t.deadline}</span>
              <span style={{ fontWeight: 700, color: ac.st === 'need_info' ? '#8a5a10' : 'inherit' }}>{due(ac.deadline)} IST</span>
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

          {stepError && (
            <div
              style={{
                background: '#fdf3e4',
                border: '1px solid #ecd9b8',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 12,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: '#5c3400',
              }}
            >
              {t.stepSaveFailed} {stepError}
            </div>
          )}

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
                {capPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={capPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8">
                    <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                )}
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
              {geoCoords.str || t.noLocation}
              <br />
              {capStamp} IST · {stampDate}
            </div>
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {capError && (
            <div
              style={{
                background: '#fdf3e4',
                border: '1px solid #ecd9b8',
                borderRadius: 14,
                padding: '12px 14px',
                marginTop: 14,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: '#5c3400',
              }}
            >
              {capError}
            </div>
          )}

          {!captured && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button
                onClick={handleShutter}
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
                onClick={clearCapture}
                disabled={capUploading}
                style={{ flex: 1, minHeight: 56, background: '#ffffff', border: '1px solid #d9d6cf', borderRadius: 999, fontSize: 15, fontWeight: 700, opacity: capUploading ? 0.5 : 1 }}
              >
                {t.retake}
              </button>
              <button
                onClick={handleAttachPhoto}
                disabled={capUploading}
                style={{ flex: 2, minHeight: 56, background: '#1b5e3f', color: '#ffffff', border: 'none', borderRadius: 999, fontSize: 15, fontWeight: 700, opacity: capUploading ? 0.6 : 1 }}
              >
                {capUploading ? t.attaching : t.attach}
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

              {docError && (
                <div
                  style={{
                    background: '#fdf3e4',
                    border: '1px solid #ecd9b8',
                    borderRadius: 14,
                    padding: '12px 14px',
                    marginTop: 16,
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: '#5c3400',
                  }}
                >
                  {docError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => handleGenerateDoc(ac)}
                  disabled={docLoading}
                  style={{
                    flex: 2,
                    minHeight: 56,
                    background: '#1c1c1a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 700,
                    opacity: docLoading ? 0.6 : 1,
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
                  {docLoading ? t.docGenerating : shareFlash ? t.docDownloaded : t.docDownload}
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

      {/* Date & Time Confirmation Modal */}
      {showDateModal && dateModalCase && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowDateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 24,
              maxWidth: 480,
              width: '100%',
              padding: '24px 22px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              color: '#1c1c1a',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#b45309' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {L('ದಿನಾಂಕ ಧೃಡೀಕರಣ', 'Date Confirmation')}
                </span>
              </div>
              <button
                onClick={() => setShowDateModal(false)}
                style={{ background: '#f1f0ec', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#6f6b63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: '#1c1c1a', lineHeight: 1.25 }}>
              {L('ಘಟನೆಯ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ ನಮೂದಿಸಿ', 'Set Event Date & Time')}
            </h2>
            <div style={{ fontSize: 13.5, color: '#6f6b63', lineHeight: 1.5, marginBottom: 20 }}>
              {L(
                'ಬೆಳೆ ಹಾನಿ ಅಥವಾ ಘಟನೆ ನಡೆದ ನಿಖರ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ ಆಯ್ಕೆಮಾಡಿ. ಇದರಿಂದ 72 ಗಂಟೆಗಳ ಗಡಿಯಾರ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.',
                'Select the date and time when the incident occurred. This starts the 72-hour official countdown clock.'
              )}
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6f6b63', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {L('ತ್ವರಿತ ಆಯ್ಕೆಗಳು', 'Quick Presets')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    setSelectedDate(d.toISOString().split('T')[0])
                    setSelectedTime('08:00')
                  }}
                  style={{
                    background: '#f8f7f3',
                    border: '1.5px solid #d9d6cf',
                    borderRadius: 12,
                    padding: '10px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#1c1c1a',
                    textAlign: 'center',
                  }}
                >
                  {L('ಇಂದು', 'Today')}<br />
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#6f6b63' }}>08:00 AM</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 1)
                    setSelectedDate(d.toISOString().split('T')[0])
                    setSelectedTime('20:00')
                  }}
                  style={{
                    background: '#f8f7f3',
                    border: '1.5px solid #d9d6cf',
                    borderRadius: 12,
                    padding: '10px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#1c1c1a',
                    textAlign: 'center',
                  }}
                >
                  {L('ನಿನ್ನೆ', 'Yesterday')}<br />
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#6f6b63' }}>~Night</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 2)
                    setSelectedDate(d.toISOString().split('T')[0])
                    setSelectedTime('12:00')
                  }}
                  style={{
                    background: '#f8f7f3',
                    border: '1.5px solid #d9d6cf',
                    borderRadius: 12,
                    padding: '10px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#1c1c1a',
                    textAlign: 'center',
                  }}
                >
                  {L('2 ದಿನ ಹಿಂದೆ', '2 Days Ago')}<br />
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#6f6b63' }}>~Noon</span>
                </button>
              </div>
            </div>

            {/* Form Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#4a4740', marginBottom: 6 }}>
                  {L('ದಿನಾಂಕ ಆಯ್ಕೆಮಾಡಿ', 'Select Date')}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 16,
                    fontWeight: 600,
                    border: '1.5px solid #c6c2b9',
                    borderRadius: 12,
                    background: '#fafaf8',
                    color: '#1c1c1a',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#4a4740', marginBottom: 6 }}>
                  {L('ಸಮಯ ಆಯ್ಕೆಮಾಡಿ', 'Select Time')}
                </label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 16,
                    fontWeight: 600,
                    border: '1.5px solid #c6c2b9',
                    borderRadius: 12,
                    background: '#fafaf8',
                    color: '#1c1c1a',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowDateModal(false)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  background: '#f1f0ec',
                  color: '#4a4740',
                  border: 'none',
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {L('ರದ್ದುಗೊಳಿಸಿ', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDateSave}
                style={{
                  flex: 2,
                  minHeight: 52,
                  background: '#1b5e3f',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {L('ದಿನಾಂಕ ಧೃಡೀಕರಿಸಿ', 'Confirm & Start Clock')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
