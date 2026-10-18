// Legacy browser microphone controller. Tracks stay muted until push-to-talk.
(function () {
  'use strict';
  const events = [], peers = new Map();
  let stream = null, userId = '', active = false;
  const emit = (event, data = {}) => events.push({event, data});
  const config = {iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
  async function getPeer(id) {
    if (peers.has(id)) return peers.get(id);
    const pc = new RTCPeerConnection(config);
    peers.set(id, pc);
    pc.onicecandidate = e => {if(e.candidate) emit('signal',{to:id,candidate:e.candidate.toJSON()});};
    pc.ontrack = e => {
      let audio = document.getElementById('legacy-voice-' + id);
      if (!audio) { audio=document.createElement('audio'); audio.id='legacy-voice-'+id; audio.autoplay=true; audio.playsInline=true; document.body.appendChild(audio); }
      audio.srcObject=e.streams[0]; audio.play().catch(()=>{});
    };
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t,stream));
    return pc;
  }
  window.LegacyVoice = {
    async enable(id) {
      if (active) return;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Error('Browser microphone access unavailable');
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
        stream.getAudioTracks().forEach(t=>t.enabled=false);
        userId=id; active=true; emit('enabled');
      } catch(e) {active=false;emit('error',{message:'Microphone permission failed: '+(e.message||e)});}
    },
    disable() {
      active=false; if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
      for(const id of [...peers.keys()]) this.leave(id);
      emit('disabled');
    },
    talk(pressed) {if(stream)stream.getAudioTracks().forEach(t=>t.enabled=!!pressed&&active);},
    async offer(id) {try{if(!active)return;const pc=await getPeer(id);const offer=await pc.createOffer();await pc.setLocalDescription(offer);emit('signal',{to:id,description:pc.localDescription.toJSON()});}catch(e){emit('error',{message:String(e)});}},
    async receive(id, payload) {try{if(!active)return;const pc=await getPeer(id);if(payload.description){await pc.setRemoteDescription(payload.description);if(payload.description.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);emit('signal',{to:id,description:pc.localDescription.toJSON()});}}if(payload.candidate)await pc.addIceCandidate(payload.candidate);}catch(e){emit('error',{message:String(e)});}},
    position(id, volume) {const el=document.getElementById('legacy-voice-'+id);if(el)el.volume=Math.max(0,Math.min(1,volume));},
    leave(id) {const pc=peers.get(id);if(pc){pc.close();peers.delete(id);}const el=document.getElementById('legacy-voice-'+id);if(el)el.remove();},
    poll() {return JSON.stringify(events.splice(0));}
  };
})();
