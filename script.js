// Get DOM elements
const canvas = document.getElementById('visualizer'); //get canvas element  
const ctx = canvas.getContext('2d'); //get context
const startBtn = document.getElementById('startBtn'); //get start button element
const stopBtn = document.getElementById('stopBtn'); //get stop button element
const fileInput = document.getElementById('fileInput'); //get file input element
const playBtn = document.getElementById('playBtn'); //get play button element           
const pauseBtn = document.getElementById('pauseBtn'); //get pause button element
const volumeSlider = document.getElementById('volumeSlider'); //get volume slider element
const volumeValue = document.getElementById('volumeValue'); //get volume value element
const volumeControl = document.querySelector('.volume-control'); //get volume control element
const fileNameDisplay = document.getElementById('fileNameDisplay'); //get file name display element

// Set canvas size
function resizeCanvas() { //resize canvas 
    canvas.width = Math.min(800, window.innerWidth - 80); //set canvas width
    canvas.height = 400; //set canvas height
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas); //add event listener to window

// Audio context and variables
let audioContext; //audio context
let analyser; //analyser
let dataArray; //data array
let source; //source
let gainNode; //gain node
let animationId; //animation id
let isPlaying = false; //is playing
let isPaused = false; //is paused
let audioBuffer = null;
let startOffset = 0; //start offset
let startTime = 0; //start time
let isAudioFile = false;
let mediaStream = null; //media stream

// Initialize audio context
function initAudioContext() { //initialize audio context
    if (!audioContext) { //if audio context is not initialized, initialize it
        audioContext = new (window.AudioContext || window.webkitAudioContext)(); //create audio context
        analyser = audioContext.createAnalyser(); //create analyser
        analyser.fftSize = 256; //set fft size
        const bufferLength = analyser.frequencyBinCount; //get buffer length
        dataArray = new Uint8Array(bufferLength); //create data array
    }
}

// Start microphone input
async function startMicrophone() { //start microphone input
    try { //try to start microphone
        initAudioContext(); //initialize audio context
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); //get user media
        mediaStream = stream; //set media stream
        
        if (source) { //if source is not null, disconnect it
            source.disconnect(); //disconnect source
        }
        
        // Create gain node for volume control
        gainNode = audioContext.createGain(); //create gain node
        gainNode.gain.value = volumeSlider.value / 100; //set gain value
        
        source = audioContext.createMediaStreamSource(stream); //create media stream source
        source.connect(gainNode); //connect source to gain node
        gainNode.connect(analyser); //connect gain node to analyser
        analyser.connect(audioContext.destination); //connect analyser to destination
        
        isPlaying = true; //set is playing to true
        isPaused = false; //set is paused to false
        isAudioFile = false;
        startBtn.disabled = true; //set start button to disabled
        stopBtn.disabled = false; //set stop button to disabled
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'none'; //set pause button to display none
        volumeControl.style.display = 'flex';
        
        visualize(); //visualize
    } catch (error) {
        console.error('Error accessing microphone:', error); //log error
        alert('Could not access microphone. Please check permissions.');
    }
}

// Load and play audio file
function loadAudioFile(file) { //load audio file
    const reader = new FileReader(); //create file reader
    
    reader.onload = function(e) {
        const audioData = e.target.result; //get audio data
        
        initAudioContext(); //initialize audio context  
        
        audioContext.decodeAudioData(audioData).then(function(buffer) {
            audioBuffer = buffer; //set audio buffer
            startOffset = 0; //set start offset to 0
            isAudioFile = true;
            
            playAudio(); //play audio
        }).catch(function(error) {
            console.error('Error decoding audio:', error);
            alert('Error loading audio file.'); //alert error
        });
    };
    
    reader.readAsArrayBuffer(file); //read audio file as array buffer
}

// Play audio file
function playAudio() { //play audio file
    if (!audioBuffer) return; //if audio buffer is not set, return
    
    // Ensure audio context is initialized and running
    if (!audioContext) {
        initAudioContext(); //initialize audio context
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume(); //resume audio context
    }
    
    // Clean up existing source if any
    if (source) {
        try {
            source.disconnect(); //disconnect source
        } catch (e) {
            // Already disconnected
        }
        source = null; //set source to null
    }
    
    // Create gain node for volume control (reuse if exists, otherwise create new)
    if (!gainNode) {
        gainNode = audioContext.createGain(); //create gain node
    }
    gainNode.gain.value = volumeSlider.value / 100; //set gain value        
    
    // Create new source
    source = audioContext.createBufferSource(); //create buffer source
    source.buffer = audioBuffer; //set buffer to audio buffer   
    
    // Connect the audio graph
    source.connect(gainNode); //connect source to gain node
    gainNode.connect(analyser); //connect gain node to analyser
    analyser.connect(audioContext.destination); //connect analyser to destination
    
    // Handle when audio ends
    source.onended = function() {
        if (isPlaying) {
            stopVisualization(); //stop visualization
        }
    };
    
    // Record start time and play from offset
    startTime = audioContext.currentTime; //set start time to current time
    
    // Make sure offset doesn't exceed buffer duration
    const offset = Math.min(startOffset, audioBuffer.duration - 0.1); //set offset to minimum of start offset and buffer duration minus 0.1
    
    try {
        source.start(0, offset); //start source at offset
    } catch (e) {
        console.error('Error starting audio:', e); //log error
        // If there's an error, reset and try from beginning
        startOffset = 0; //set start offset to 0
        source.start(0, 0); //start source at 0
    }
    
    isPlaying = true; //set is playing to true      
    isPaused = false; //set is paused to false
    startBtn.disabled = true; //set start button to disabled
    stopBtn.disabled = false; //set stop button to disabled
    playBtn.style.display = 'none'; //set play button to display none
    pauseBtn.style.display = 'inline-block'; //set pause button to display inline block
    pauseBtn.disabled = false; //set pause button to disabled
    volumeControl.style.display = 'flex'; //set volume control to display flex
    
    // Start visualization
    visualize(); //visualize
}

// Pause audio
function pauseAudio() { //pause audio           
    if (!isPlaying || !isAudioFile) return; //if is playing is not true or is audio file is not true, return
    
    // Stop the animation loop
    if (animationId) {
        cancelAnimationFrame(animationId); //cancel animation frame
        animationId = null;
    }
    
    if (source) {
        // Calculate how much time has elapsed since we started playing
        const elapsed = audioContext.currentTime - startTime; //set elapsed to current time minus start time    
        startOffset += elapsed; //add elapsed to start offset
        
        // Stop the source
        try {
            source.stop(); //stop source
        } catch (e) {
            // Source might already be stopped
            console.log('Source already stopped'); //log error
        }
        source.disconnect(); //disconnect source
        source = null; //set source to null
    }
    
    isPlaying = false; //set is playing to false
    isPaused = true; //set is paused to true
    playBtn.style.display = 'inline-block'; //set play button to display inline block
    playBtn.disabled = false; //set play button to disabled
    pauseBtn.style.display = 'none'; //set pause button to display none
    
    // Clear canvas to show paused state
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; //set fill style
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Resume audio
function resumeAudio() { //resume audio
    if (!isPaused || !isAudioFile || !audioBuffer) return; //if is paused is not true or is audio file is not true or audio buffer is not set, return
    
    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
        audioContext.resume(); //resume audio context
    }
    
    // Make sure we don't exceed the buffer duration
    if (startOffset >= audioBuffer.duration) { //if start offset is greater than or equal to buffer duration, set start offset to 0
        startOffset = 0; // Restart if we've reached the end
    }
    
    playAudio(); //play audio
}

// Stop visualization
function stopVisualization() { //stop visualization
    // Stop animation loop
    if (animationId) {
        cancelAnimationFrame(animationId); //cancel animation frame
        animationId = null;
    }
    
    // Stop audio source
    if (source) {
        try {
            if (source.stop) {
                source.stop(); //stop source
            }
        } catch (e) {
            // Source might already be stopped
        }
        try {
            if (source.disconnect) {
                source.disconnect(); //disconnect source        
            }
        } catch (e) {
            // Already disconnected
        }
        source = null; //set source to null
    }
    
    // Stop media stream tracks if using microphone
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop()); //stop media stream tracks
        mediaStream = null; //set media stream to null
    }
    
    // Don't close audio context if we're just pausing - only close on full stop
    // We'll keep it open so we can resume
    
    isPlaying = false; //set is playing to false
    isPaused = false; //set is paused to false
    startOffset = 0;
    audioBuffer = null; //set audio buffer to null
    isAudioFile = false;
    fileNameDisplay.textContent = ''; //clear file name display
    startBtn.disabled = false; //set start button to disabled
    stopBtn.disabled = true; //set stop button to disabled
    playBtn.style.display = 'none';
    pauseBtn.style.display = 'none'; //set pause button to display none
    playBtn.disabled = true;
    pauseBtn.disabled = true; //set pause button to disabled
    volumeControl.style.display = 'none'; //set volume control to display none
    fileNameDisplay.textContent = ''; //clear file name display
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; //set fill style  
    ctx.fillRect(0, 0, canvas.width, canvas.height); //fill rect
    
    // Close audio context after a delay to allow cleanup
    if (audioContext && audioContext.state !== 'closed') { //if audio context is not closed, set timeout
        setTimeout(() => {
            if (audioContext && !isPlaying && !isPaused) { //if audio context is not playing and not paused, close audio context
                audioContext.close().then(() => {
                    audioContext = null; //set audio context to null
                    gainNode = null; //set gain node to null
                }).catch(e => {
                    console.log('Error closing audio context:', e); //log error
                });
            }
        }, 100); //set timeout to 100ms
    }
}

// Visualization function
function visualize() { //visualization function
    if (!isPlaying) return; //if is playing is not true, return
    
    animationId = requestAnimationFrame(visualize); //request animation frame
    
    analyser.getByteFrequencyData(dataArray); //get byte frequency data
    
    // Clear canvas with fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; //set fill style
    ctx.fillRect(0, 0, canvas.width, canvas.height); //fill rect
    
    const barWidth = canvas.width / dataArray.length * 2; //set bar width to canvas width divided by data array length times 2
    let x = 0; //set x to 0             
    
    // Draw frequency bars
    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height; //set bar height to data array at index i divided by 255 times canvas height
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height); //create linear gradient
        const hue = (i / dataArray.length) * 360; //set hue to index i divided by data array length times 360       
        gradient.addColorStop(0, `hsl(${hue}, 100%, 50%)`); //add color stop to gradient
        gradient.addColorStop(1, `hsl(${hue + 60}, 100%, 30%)`); //add color stop to gradient
        
        ctx.fillStyle = gradient; //set fill style to gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        
        x += barWidth; //add bar width to x
    }
    
}

// Update volume
function updateVolume() { //update volume
    if (gainNode) {
        gainNode.gain.value = volumeSlider.value / 100; //set gain value to volume slider value divided by 100
    }
    volumeValue.textContent = Math.round(volumeSlider.value) + '%'; //set volume value to volume slider value rounded to nearest integer plus '%'
}

// Event listeners
startBtn.addEventListener('click', startMicrophone); //add event listener to start button
stopBtn.addEventListener('click', stopVisualization); //add event listener to stop button
playBtn.addEventListener('click', resumeAudio); //add event listener to play button
pauseBtn.addEventListener('click', pauseAudio); //add event listener to pause button        
volumeSlider.addEventListener('input', updateVolume); //add event listener to volume slider

fileInput.addEventListener('change', function(e) { //add event listener to file input
    const file = e.target.files[0]; //get file
    if (file) { //if file is not null, stop visualization and load audio file   
        stopVisualization(); //stop visualization        
        fileNameDisplay.textContent = `Now Playing: ${file.name}`; //display file name               
        loadAudioFile(file); //load audio file
    }
}); //add event listener to file input

// Initial canvas clear
ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; //set fill style
ctx.fillRect(0, 0, canvas.width, canvas.height); //fill rect    

