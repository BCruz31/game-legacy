// Browser WebRTC voice engine for Legacy. Loaded by the isolated assistant-test export.
// Signaling travels through the authenticated Supabase Realtime channel via Godot.
(() => {
  if (window.LegacyVoice) return;
  const peers = new Map();
  const audio = new Map();
  let stream = null, enabled = false, transmitting = false, selfId = '';
  const queue = [];
  const iceServers = [{urls: 'stun:stun.l.google.com:19302'}];
  const emit = (event, data) => queue.push({event, data});
  async function microphone() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation:true, noiseSuppression:true}, video:false});
    stream.getAudioTracks().forEach(t => t.enabled = false);
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
      for(const id of [...peers.keys()]) closePeer(id);
      emit('disabled', {});
    },
    talk(active) {
      transmitting = !!active && enabled;
      if(stream) stream.getAudioTracks().forEach(t=>t.enabled=transmitting);
    },
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