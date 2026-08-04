Place these files here:

santa-ruiz-story.mp3
documentary-cues.json          — legacy coarse chapter cues
documentary-camera-cues.json   — Whisper-analyzed camera sync (generated)
transcript/santa-ruiz-story.json — full narration transcript (generated)

The MP3 is the master clock. Map panning follows documentary-camera-cues.json,
built from Whisper transcript analysis:

  npm run sync:documentary
