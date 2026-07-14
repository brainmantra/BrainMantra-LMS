let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// 1. Slide bead click sound
export function playBeadClick() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, ctx.currentTime) // initial pitch
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.05) // rapid drop
    
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05) // rapid decay
    
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    osc.start()
    osc.stop(ctx.currentTime + 0.06)
  } catch (e) {
    console.warn('Audio synth error:', e)
  }
}

// 2. Correct answer arpeggio chime
export function playCorrectChime() {
  try {
    const ctx = getAudioContext()
    const notes = [261.63, 329.63, 392.00, 523.25] // C4, E4, G4, C5 arpeggio
    
    notes.forEach((freq, index) => {
      const timeOffset = index * 0.08
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + timeOffset)
      
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime + timeOffset)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + 0.25)
      
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      osc.start(ctx.currentTime + timeOffset)
      osc.stop(ctx.currentTime + timeOffset + 0.3)
    })
  } catch (e) {
    console.warn('Audio synth error:', e)
  }
}

// 3. Incorrect answer low buzzer
export function playIncorrectBuzzer() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(130, ctx.currentTime) // low bass buzz
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.25)
    
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    osc.start()
    osc.stop(ctx.currentTime + 0.26)
  } catch (e) {
    console.warn('Audio synth error:', e)
  }
}

// 4. Trombone/Trumpet major scale complete fanfare
export function playFanfare() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    // C5, E5, G5, C6 notes with brassy square waves
    const fanfareNotes = [
      { f: 523.25, d: 0.12 },
      { f: 659.25, d: 0.12 },
      { f: 783.99, d: 0.12 },
      { f: 1046.50, d: 0.4 }
    ]
    
    let cumulativeTime = 0
    fanfareNotes.forEach((note) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(note.f, now + cumulativeTime)
      
      gainNode.gain.setValueAtTime(0.12, now + cumulativeTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + cumulativeTime + note.d)
      
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      osc.start(now + cumulativeTime)
      osc.stop(now + cumulativeTime + note.d + 0.05)
      
      cumulativeTime += note.d - 0.02
    })
  } catch (e) {
    console.warn('Audio synth error:', e)
  }
}
