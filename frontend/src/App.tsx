import { useState, useRef, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, Search, Music, Heart, Loader2, RotateCcw, RotateCw, Download, Check } from 'lucide-react'
import './index.css'

interface Video {
  id: string
  title: string
  author: string
  thumbnail: string
  duration: string
  views: string
  url: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

async function fetchStreamError(videoId: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/stream/${videoId}`)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return data?.error || `Failed to load audio (HTTP ${res.status})`
    }
    return 'Failed to load the audio stream. The song may be blocked from streaming.'
  } catch {
    return 'Cannot reach the music server. Check that the backend is running.'
  }
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [videos, setVideos] = useState<Video[]>([])
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(75)
  const [isMuted, setIsMuted] = useState(false)
  const [prevVolume, setPrevVolume] = useState(75)
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set())
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
    }
  }, [volume, isMuted])

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      if (volume === 0) {
        setVolume(prevVolume || 75)
      }
    } else {
      setPrevVolume(volume)
      setIsMuted(true)
    }
  }

  useEffect(() => {
    if (audioRef.current && currentVideo) {
      if (isPlaying) {
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.error('Playback error:', err)
          })
        }
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying, currentVideo])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setVideos(data.videos || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handlePlayPause = () => {
    if (!currentVideo) {
      if (videos.length > 0) {
        setCurrentVideo(videos[0])
        setIsPlaying(true)
      }
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  const handleNext = () => {
    if (!currentVideo || videos.length === 0) return
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id)
    const nextIndex = (currentIndex + 1) % videos.length
    setCurrentVideo(videos[nextIndex])
    setIsPlaying(true)
  }

  const handlePrevious = () => {
    if (!currentVideo || videos.length === 0) return
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id)
    const prevIndex = currentIndex === 0 ? videos.length - 1 : currentIndex - 1
    setCurrentVideo(videos[prevIndex])
    setIsPlaying(true)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current && currentVideo) {
      const cur = audioRef.current.currentTime || 0
      const dur = audioRef.current.duration || 0
      setCurrentTime(cur)
      if (dur && !isNaN(dur) && isFinite(dur)) {
        setDuration(dur)
      }
    }
  }

  const handleSkipSeconds = (seconds: number) => {
    if (!audioRef.current) return
    const dur = audioRef.current.duration || duration
    const cur = audioRef.current.currentTime || 0
    let newTime = cur + seconds
    if (newTime < 0) newTime = 0
    if (dur && newTime > dur) newTime = dur
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVideoSelect = (video: Video) => {
    setCurrentVideo(video)
    setPlaybackError(null)
    setIsPlaying(true)
  }

  const handleDownload = (video: Video) => {
    if (downloadingIds.has(video.id)) return
    setDownloadingIds(prev => new Set(prev).add(video.id))
    try {
      const a = document.createElement('a')
      a.href = `${API_BASE_URL}/api/download/${video.id}?title=${encodeURIComponent(video.title)}`
      a.download = `${video.title.replace(/[/\\?%*:|"<>]/g, '_')}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setDownloadedIds(prev => new Set(prev).add(video.id))
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev)
        next.delete(video.id)
        return next
      })
    }
  }

  const toggleLike = (video: Video) => {
    const newLiked = new Set(likedVideos)
    if (newLiked.has(video.id)) {
      newLiked.delete(video.id)
    } else {
      newLiked.add(video.id)
      handleDownload(video)
    }
    setLikedVideos(newLiked)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Music className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              SoundWave
            </h1>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search YouTube videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
          </button>
        </form>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold mb-4">
              {videos.length > 0 ? `Results (${videos.length})` : 'Search for videos'}
            </h2>
            {isSearching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-12">
                <Music className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">Search for YouTube videos to get started</p>
              </div>
            ) : (
              videos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => handleVideoSelect(video)}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                    currentVideo?.id === video.id
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                  }`}
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-32 h-20 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate line-clamp-2">{video.title}</h3>
                    <p className="text-gray-400 text-sm truncate">{video.author}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{video.duration}</span>
                      <span>•</span>
                      <span>{video.views} views</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(video)
                      }}
                      title="Download for offline playback"
                      disabled={downloadingIds.has(video.id)}
                      className={`p-2 rounded-full transition-colors ${
                        downloadedIds.has(video.id)
                          ? 'text-green-400 hover:text-green-300'
                          : 'text-gray-400 hover:text-purple-400'
                      }`}
                    >
                      {downloadingIds.has(video.id) ? (
                        <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                      ) : downloadedIds.has(video.id) ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleLike(video)
                      }}
                      title={likedVideos.has(video.id) ? 'Liked (Downloaded)' : 'Like & Download'}
                      className={`p-2 rounded-full transition-colors ${
                        likedVideos.has(video.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${likedVideos.has(video.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Now Playing - Spotify Style */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl">
              <h2 className="text-xl font-semibold mb-4">Now Playing</h2>
              
              {currentVideo ? (
                <>
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-4 shadow-2xl">
                    <img
                      src={currentVideo.thumbnail}
                      alt={currentVideo.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="min-w-0 flex-1 pr-2">
                      <h3 className="text-lg font-bold truncate">{currentVideo.title}</h3>
                      <p className="text-gray-400 text-sm truncate">{currentVideo.author}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(currentVideo)}
                        title="Download for offline playback"
                        disabled={downloadingIds.has(currentVideo.id)}
                        className={`p-2 rounded-full transition-colors bg-white/5 hover:bg-white/10 ${
                          downloadedIds.has(currentVideo.id) ? 'text-green-400' : 'text-gray-300 hover:text-purple-400'
                        }`}
                      >
                        {downloadingIds.has(currentVideo.id) ? (
                          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                        ) : downloadedIds.has(currentVideo.id) ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleLike(currentVideo)}
                        title={likedVideos.has(currentVideo.id) ? 'Liked (Downloaded)' : 'Like & Download'}
                        className={`p-2 rounded-full transition-colors bg-white/5 hover:bg-white/10 ${
                          likedVideos.has(currentVideo.id) ? 'text-red-500' : 'text-gray-300 hover:text-red-500'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${likedVideos.has(currentVideo.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {playbackError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                      {playbackError}
                    </div>
                  )}

                  {/* Track Position Range Seek Slider */}
                  <div className="relative flex items-center mb-2">
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      step="0.1"
                      value={currentTime}
                      onChange={(e) => {
                        const newTime = Number(e.target.value)
                        if (audioRef.current) {
                          audioRef.current.currentTime = newTime
                        }
                        setCurrentTime(newTime)
                      }}
                      className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                    />
                  </div>

                  <div className="flex justify-between text-xs text-gray-400 mb-6">
                    <span>{formatTime(currentTime)}</span>
                    <span>{currentVideo.duration}</span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6">
                    <button
                      onClick={handlePrevious}
                      title="Previous Track"
                      className="p-2 rounded-full hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
                    >
                      <SkipBack className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => handleSkipSeconds(-10)}
                      title="Rewind 10s"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-gray-700 transition-colors text-gray-300 hover:text-white text-xs font-semibold border border-white/10"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>-10s</span>
                    </button>

                    <button
                      onClick={handlePlayPause}
                      className="p-4 rounded-full bg-white text-black hover:scale-105 transition-all shadow-lg mx-1"
                    >
                      {isLoading ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="w-8 h-8" />
                      ) : (
                        <Play className="w-8 h-8 ml-1" />
                      )}
                    </button>

                    <button
                      onClick={() => handleSkipSeconds(10)}
                      title="Forward 10s"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-gray-700 transition-colors text-gray-300 hover:text-white text-xs font-semibold border border-white/10"
                    >
                      <span>+10s</span>
                      <RotateCw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleNext}
                      title="Next Track"
                      className="p-2 rounded-full hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
                    >
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Sound / Volume Adjustment */}
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                    <button
                      onClick={toggleMute}
                      title={isMuted ? 'Unmute' : 'Mute'}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5 text-red-400" />
                      ) : volume < 50 ? (
                        <Volume1 className="w-5 h-5 text-purple-400" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-purple-400" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setVolume(val)
                        if (val > 0 && isMuted) {
                          setIsMuted(false)
                        }
                      }}
                      className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                    />
                    <span className="text-xs font-semibold text-gray-300 w-8 text-right">
                      {isMuted ? '0%' : `${volume}%`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Music className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400">Select a video to play</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={currentVideo ? `${API_BASE_URL}/api/stream/${currentVideo.id}` : undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleNext}
        onLoadStart={() => { setIsLoading(true); setPlaybackError(null) }}
        onCanPlay={() => setIsLoading(false)}
        onError={async (e) => {
          console.error('Audio load error:', e)
          setIsLoading(false)
          setIsPlaying(false)
          const message = currentVideo ? await fetchStreamError(currentVideo.id) : 'Failed to load the audio stream.'
          setPlaybackError(message)
        }}
      />
    </div>
  )
}

export default App
