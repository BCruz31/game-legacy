// Browser WebRTC voice engine for Legacy. Loaded by the isolated assistant-test export.
// Signaling travels through the authenticated Supabase Realtime channel via Godot.
(() => {
  if (window.LegacyVoice) return;
  const peers = new Map();
  const audio = new Map();
  let stream = null, enabled = false, transmitting = false, selfId = '';
  let meterContext, analyser, source, gainNode, testing = false, gain = 1;
  const queue = [];
  const iceServers = [{urls: 'stun:stun.l.google.com:19302'}];
  const emit = (event, data) => queue.push({event, data});
  async function microphone() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation:true, noiseSuppression:true}, video:false});
    stream.getAudioTracks().forEach(t => t.enabled = false);
    meterContext = new (window.AudioContext || window.webkitAudioContext)();
    source = meterContext.createMediaStreamSource(stream);
    analyser = meterContext.createAnalyser();
    analyser.fftSize = 512;
    gainNode = meterContext.createGain();
    gainNode.gain.value = gain;
    source.connect(gainNode);
    gainNode.connect(analyser);
    return stream;
  }
  async function peerFor(id) {
    if (peers.has(id)) return peers.get(id);
    const pc = new RTCPeerConnection({iceServers});
    peers.set(id, pc);
    pc.onicecandidate = e => {if(e.candidate) emit('signal', {to:id, candidate:e.candidate.toJSON()});};
    pc.ontrack = e => {
      let el = audio.get(id);
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true; el.playsInline = true;
        el.style.display = 'none';
        document.body.appendChild(el);
        audio.set(id, el);
      }
      el.srcObject = e.streams[0];
      el.play().catch(() => emit('play_blocked', {id}));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(id);
    };
    const local = await microphone();
    local.getTracks().forEach(track => pc.addTrack(track, local));
    return pc;
  }
  function closePeer(id) {
    const pc = peers.get(id);
    peers.delete(id);
    if (pc) pc.close();
    const el = audio.get(id);
    audio.delete(id);
    if (el) {el.srcObject = null; el.remove();}
  }
  window.LegacyVoice = {
    async enable(id) {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices) throw Error('HTTPS microphone access unavailable');
        selfId = id;
        await microphone();
        enabled = true;
        emit('enabled', {});
        return true;
      } catch (e) {emit('error', {message:String(e)}); return false;}
    },
    disable() {
      enabled = false; transmitting = false;
      if (stream) {stream.getTracks().forEach(t=>t.stop()); stream = null;}
      testing=false;
      if(meterContext) {meterContext.close(); meterContext=null; analyser=null; source=null; gainNode=null;}
      for(const id of [...peers.keys()]) closePeer(id);
      emit('disabled', {});
    },
    talk(active) {
      transmitting = !!active && enabled;
      if(stream) stream.getAudioTracks().forEach(t=>t.enabled=transmitting || testing);
    },
    setGain(value) {gain=Math.max(0,Math.min(2,Number(value)||0)); if(gainNode) gainNode.gain.value=gain;},
    startTest() {if(!enabled || !stream) return; testing=true; if(meterContext?.state==='suspended') meterContext.resume(); stream.getAudioTracks().forEach(t=>t.enabled=true);},
    stopTest() {testing=false; if(stream) stream.getAudioTracks().forEach(t=>t.enabled=transmitting);},
    meter() {if(!testing || !analyser) return 0; const a=new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a); let s=0; for(const x of a)s+=x*x; return Math.min(1,Math.sqrt(s/a.length)*8);},
    async offer(id) {
      if(!enabled || !id || id===selfId) return;
      try {
        const pc=await peerFor(id);
        const offer=await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit('signal',{to:id,description:pc.localDescription.toJSON()});
      } catch(e) {emit('error',{message:String(e)});}
    },
    async receive(from, payload) {
      if(!enabled || !from || from===selfId) return;
      try {
        const pc=await peerFor(from);
        if(payload.description) {
          const desc=payload.description;
          // Stable deterministic offerer avoids simultaneous glare.
          if(desc.type==='offer' && pc.signalingState!=='stable') return;
          await pc.setRemoteDescription(new RTCSessionDescription(desc));
          if(desc.type==='offer') {
            const answer=await pc.createAnswer();
            await pc.setLocalDescription(answer);
            emit('signal',{to:from,description:pc.localDescription.toJSON()});
          }
        }
        if(payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch(e) {emit('error',{message:String(e)});}
    },
    position(id, volume) {
      const el=audio.get(id);
      if(el) el.volume=Math.max(0,Math.min(1,Number(volume)||0));
    },
    leave(id) {closePeer(id);},
    poll() {return JSON.stringify(queue.splice(0,100));},
    get enabled() {return enabled;},
    get transmitting() {return transmitting;}
  };
})();