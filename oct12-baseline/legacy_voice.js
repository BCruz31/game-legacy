// Legacy browser microphone controller. Tracks stay muted until push-to-talk.
(function () {
  'use strict';
  const events = [], peers = new Map();
  let stream = null, userId = '', active = false;
  let audioContext = null, analyser = null, gainNode = null, processedStream = null, testing = false, gain = 1;
  const meterSamples = new Uint8Array(512);
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
    if (processedStream) processedStream.getTracks().forEach(t => pc.addTrack(t,processedStream));
    return pc;
  }
  window.LegacyVoice = {
    async enable(id) {
      if (active) return;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Error('Browser microphone access unavailable');
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        gainNode = audioContext.createGain();
        gainNode.gain.value = gain;
        source.connect(analyser);
        source.connect(gainNode);
        const output = audioContext.createMediaStreamDestination();
        gainNode.connect(output);
        processedStream = output.stream;
        processedStream.getAudioTracks().forEach(t=>t.enabled=false);
        userId=id; active=true; emit('enabled');
      } catch(e) {active=false;emit('error',{message:'Microphone permission failed: '+(e.message||e)});}
    },
    disable() {
      active=false; testing=false; if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
      if(processedStream){processedStream.getTracks().forEach(t=>t.stop());processedStream=null;}
      if(audioContext){audioContext.close().catch(()=>{});audioContext=null;}
      analyser=null;gainNode=null;
      for(const id of [...peers.keys()]) this.leave(id);
      emit('disabled');
    },
    talk(pressed) {if(processedStream)processedStream.getAudioTracks().forEach(t=>t.enabled=!!pressed&&active&&!testing);},
    setGain(value) {gain=Math.max(0,Math.min(2,Number(value)||0));if(gainNode)gainNode.gain.value=gain;},
    startTest() {testing=!!active;if(processedStream)processedStream.getAudioTracks().forEach(t=>t.enabled=false);return testing;},
    stopTest() {testing=false;},
    testLevel() {
      if(!testing||!analyser)return 0;
      analyser.getByteTimeDomainData(meterSamples);
      let sum=0;
      for(let i=0;i<meterSamples.length;i++){const v=(meterSamples[i]-128)/128;sum+=v*v;}
      return Math.min(1,Math.sqrt(sum/meterSamples.length)*4*gain);
    },
    async offer(id) {try{if(!active)return;const pc=await getPeer(id);const offer=await pc.createOffer();await pc.setLocalDescription(offer);emit('signal',{to:id,description:pc.localDescription.toJSON()});}catch(e){emit('error',{message:String(e)});}},
    async receive(id, payload) {try{if(!active)return;const pc=await getPeer(id);if(payload.description){await pc.setRemoteDescription(payload.description);if(payload.description.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);emit('signal',{to:id,description:pc.localDescription.toJSON()});}}if(payload.candidate)await pc.addIceCandidate(payload.candidate);}catch(e){emit('error',{message:String(e)});}},
    position(id, volume) {const el=document.getElementById('legacy-voice-'+id);if(el)el.volume=Math.max(0,Math.min(1,volume));},
    leave(id) {const pc=peers.get(id);if(pc){pc.close();peers.delete(id);}const el=document.getElementById('legacy-voice-'+id);if(el)el.remove();},
    poll() {return JSON.stringify(events.splice(0));}
  };
})();
