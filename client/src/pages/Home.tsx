import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Headphones,
  Heart,
  Library,
  ListMusic,
  Pause,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Track = {
  id: number;
  videoId?: string;
  title: string;
  artist: string;
  duration: string;
  category: string;
  accent: string;
  initials: string;
  tone: string;
  thumbnail?: string;
  description?: string;
  publishedAt?: string;
  views?: string;
};

const starterTracks: Track[] = [
  { id: 1, title: "Midnight Study Session", artist: "Lofi Girl · Chillhop Music", duration: "1:02:14", category: "lofi", accent: "from-orange-300 via-rose-400 to-fuchsia-600", initials: "MS", tone: "Study mix" },
  { id: 2, title: "Jazz Café in Paris", artist: "Cafe Music BGM channel", duration: "3:14:28", category: "jazz", accent: "from-amber-200 via-orange-500 to-red-700", initials: "JC", tone: "Jazz radio" },
  { id: 3, title: "Deep Focus — Ambient Waves", artist: "Yellow Brick Cinema", duration: "8:00:01", category: "ambient", accent: "from-cyan-300 via-sky-500 to-indigo-800", initials: "DF", tone: "Ambient" },
  { id: 4, title: "Nujabes — Feather", artist: "Nujabes · Hydeout Productions", duration: "2:42", category: "hip hop", accent: "from-lime-200 via-emerald-500 to-teal-900", initials: "NF", tone: "Hip-hop" },
  { id: 5, title: "The Sound of Rain", artist: "Relaxing White Noise", duration: "10:00:00", category: "sleep", accent: "from-slate-300 via-blue-500 to-violet-900", initials: "SR", tone: "Sleep" },
  { id: 6, title: "Neo Soul Essentials", artist: "Majestic Casual", duration: "58:37", category: "soul", accent: "from-pink-300 via-red-500 to-purple-900", initials: "NS", tone: "Soul" },
];

const accentGradients = [
  "from-orange-300 via-rose-400 to-fuchsia-600",
  "from-amber-200 via-orange-500 to-red-700",
  "from-cyan-300 via-sky-500 to-indigo-800",
  "from-lime-200 via-emerald-500 to-teal-900",
  "from-slate-300 via-blue-500 to-violet-900",
  "from-pink-300 via-red-500 to-purple-900",
];

function youtubeSearchUrl(query: string) {
  return `https://m.youtube.com/results?sp=mAEA&search_query=${encodeURIComponent(query)}`;
}

function youtubeWatchUrl(videoId?: string, fallbackQuery = "") {
  return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : youtubeSearchUrl(fallbackQuery);
}

function initialsFor(title: string) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "YT";
}

function Visualizer({ active = false }: { active?: boolean }) {
  return (
    <div className={`visualizer ${active ? "is-active" : ""}`} aria-hidden="true">
      {[12, 23, 36, 18, 30, 44, 26, 39, 16, 29, 42, 22, 34, 14, 28, 40, 20, 32, 17, 27, 38, 23, 14, 30].map((height, index) => (
        <i key={index} style={{ "--bar-height": `${height}px`, "--bar-delay": `${index * 45}ms` } as React.CSSProperties} />
      ))}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("lofi beats");
  const [submittedQuery, setSubmittedQuery] = useState("lofi beats");
  const [liveTracks, setLiveTracks] = useState<Track[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track>(starterTracks[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const playerFrameRef = useRef<HTMLIFrameElement>(null);
  const searchMutation = trpc.youtube.search.useMutation();
  const displayedTracks = hasSearched ? liveTracks : starterTracks;

  useEffect(() => {
    if (!selectedTrack.videoId || !playerFrameRef.current?.contentWindow) return;
    playerFrameRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: isPlaying ? "playVideo" : "pauseVideo", args: [] }),
      "*",
    );
  }, [isPlaying, selectedTrack.videoId]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      toast.error("Type something to search for.");
      return;
    }

    setSubmittedQuery(cleanQuery);
    setHasSearched(true);
    setLiveTracks([]);
    setIsPlaying(false);
    searchMutation.mutate(
      { query: cleanQuery },
      {
        onSuccess: (data) => {
          const mappedTracks: Track[] = data.results.map((result, index) => ({
            id: index + 1,
            videoId: result.videoId,
            title: result.title,
            artist: result.channelTitle || "YouTube channel",
            duration: result.duration || "—",
            category: cleanQuery,
            accent: accentGradients[index % accentGradients.length],
            initials: initialsFor(result.title),
            tone: "YouTube result",
            thumbnail: result.thumbnail,
            description: result.description,
            publishedAt: result.publishedAt,
            views: result.views,
          }));
          setLiveTracks(mappedTracks);
          if (mappedTracks[0]) setSelectedTrack(mappedTracks[0]);
          if (mappedTracks.length) {
            toast.success(`${mappedTracks.length} live YouTube results loaded.`);
          } else {
            toast.message("YouTube returned no video results for that search.");
          }
        },
        onError: (error) => {
          toast.error(error.message || "Could not fetch live YouTube results.");
        },
      },
    );
  }

  function selectTrack(track: Track) {
    setSelectedTrack(track);
    if (track.videoId) {
      setIsPlaying(true);
      toast.success(`Playing “${track.title}” from YouTube.`);
    } else {
      setIsPlaying(false);
      toast("Search for a live YouTube result to play it here.");
    }
  }

  function openOfficial(track: Track) {
    window.open(youtubeWatchUrl(track.videoId, `${track.title} ${track.artist}`), "_blank", "noopener,noreferrer");
  }

  function saveSelectedTrack() {
    setLiked((current) => {
      const next = !current;
      try {
        const saved = JSON.parse(localStorage.getItem("soundwave-favorites") || "[]") as string[];
        const updated = next
          ? Array.from(new Set([...saved, selectedTrack.videoId || selectedTrack.title]))
          : saved.filter((item) => item !== (selectedTrack.videoId || selectedTrack.title));
        localStorage.setItem("soundwave-favorites", JSON.stringify(updated));
      } catch {
        // Favorites still work for the current session if storage is unavailable.
      }
      toast(next ? "Saved to favorites. No audio file was downloaded." : "Removed from favorites.");
      return next;
    });
  }

  const statusText = searchMutation.isPending
    ? `Fetching live YouTube details for “${submittedQuery}”…`
    : searchMutation.isError
      ? "YouTube could not be read right now. Try again or open the official search."
      : liveTracks.length
        ? `Live results are shown here for “${submittedQuery}”. Choose a card to load it into the audio-first player.`
        : `Search YouTube from this page. Your live results will appear here for “${submittedQuery}”.`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><span>soundwave</span></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="side-nav" aria-label="Primary navigation">
          <button className="side-nav-item active"><Search size={17} /> Discover <span className="nav-pulse" /></button>
          <button className="side-nav-item" onClick={() => toast("Your saved tracks will appear here.")}><Library size={17} /> Your library</button>
          <button className="side-nav-item" onClick={() => toast("Queue controls are ready in the player.")}><ListMusic size={17} /> Listening queue <span className="queue-count">{String(Math.min(displayedTracks.length, 99)).padStart(2, "0")}</span></button>
        </nav>
        <div className="sidebar-rule" />
        <div className="sidebar-label">Your space</div>
        <button className="side-nav-item muted" onClick={() => toast("Create a playlist after choosing your first track.")}><Plus size={17} /> New playlist</button>
        <button className="side-nav-item muted" onClick={() => toast("Favorites are stored for this session.")}><Heart size={17} /> Favorites</button>
        <div className="sidebar-bottom"><div className="mini-note"><Sparkles size={14} /><span>Audio-first<br /><b>by design.</b></span></div><button className="help-button" onClick={() => setShowInfo(!showInfo)}><CircleHelp size={16} /> How it works</button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>Discover</span><span className="slash">/</span><b>{submittedQuery || "Search"}</b></div><div className="top-actions"><button className="icon-button" aria-label="How it works" onClick={() => setShowInfo(!showInfo)}><CircleHelp size={18} /></button><div className="avatar">SW</div></div></header>
        {showInfo && <div className="info-banner"><div><b>Live search is experimental.</b> Soundwave reads the public mobile search response from YouTube on the server and shows the metadata here. It does not download or convert videos into MP3 files.</div><button onClick={() => setShowInfo(false)} aria-label="Close information">×</button></div>}

        <section className="hero-section">
          <div className="eyebrow"><span className="eyebrow-dot" /> YouTube search, reimagined</div>
          <h1>Find your next<br /><em>sound.</em></h1>
          <p className="hero-copy">Search the world’s biggest video library.<br />Keep the screen quiet. Let the audio lead.</p>
          <form className="search-form" onSubmit={handleSearch}>
            <Search size={20} className="search-icon" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search YouTube" placeholder="Search artists, mixes, or moods..." />
            <button type="submit" className="search-submit" disabled={searchMutation.isPending}>{searchMutation.isPending ? "Searching…" : "Search"} <ArrowUpRight size={16} /></button>
          </form>
          <div className="search-meta"><span>Try “late night jazz”</span><span>“deep focus”</span><span>“rain sounds”</span></div>
        </section>

        <section className="results-section">
          <div className="section-heading"><div><div className="eyebrow small">{hasSearched ? "Live YouTube results" : "Curated starting points"}</div><h2>{submittedQuery ? `Inspired by “${submittedQuery}”` : "Start listening"}</h2></div><button className="filter-button" onClick={() => toast("Filters will be available after the live results load.")}><SlidersHorizontal size={15} /> Filter <ChevronDown size={14} /></button></div>
          <div className={`results-status ${searchMutation.isError ? "has-error" : ""}`}><span className="status-check">{searchMutation.isPending ? "…" : searchMutation.isError ? "!" : "✓"}</span><span>{statusText}</span><button onClick={() => window.open(youtubeSearchUrl(submittedQuery), "_blank", "noopener,noreferrer")}>View all on YouTube <ExternalLink size={12} /></button></div>
          {searchMutation.isPending && <div className="live-loading"><span className="loading-spinner" /> Reading live thumbnails and metadata from YouTube…</div>}
          {!searchMutation.isPending && hasSearched && !searchMutation.isError && liveTracks.length === 0 && <div className="empty-results"><Youtube size={22} /><b>No videos found</b><span>Try a broader title, artist, or mood.</span></div>}
          <div className="result-grid">
            {displayedTracks.map((track, index) => (
              <article className={`track-card ${selectedTrack.id === track.id ? "selected" : ""}`} key={`${track.videoId || track.id}-${track.title}`} style={{ "--card-delay": `${index * 50}ms` } as React.CSSProperties}>
                <button className={`artwork bg-gradient-to-br ${track.accent} ${track.thumbnail ? "has-thumbnail" : ""}`} onClick={() => selectTrack(track)} aria-label={`Load ${track.title}`}>
                  {track.thumbnail ? <img className="artwork-image" src={track.thumbnail} alt="" loading="lazy" /> : <><div className="artwork-noise" /><span className="artwork-initials">{track.initials}</span></>}
                  <div className="artwork-shade" /><span className="artwork-tag">{track.tone}</span><span className="artwork-play"><Play size={17} fill="currentColor" /></span>
                </button>
                <div className="track-details"><div className="track-title-row"><h3 title={track.title}>{track.title}</h3><button className="more-button" onClick={() => openOfficial(track)} aria-label={`Open ${track.title} on YouTube`}><ExternalLink size={15} /></button></div><p>{track.artist}</p>{track.description && <span className="track-description" title={track.description}>{track.description}</span>}<div className="track-footer"><span className="duration">{track.duration}{track.views ? ` · ${track.views}` : ""}</span><button className="listen-button" onClick={() => selectTrack(track)}>{selectedTrack.id === track.id && isPlaying ? "Playing" : "Listen"} <Headphones size={13} /></button></div>{track.publishedAt && <div className="track-published">{track.publishedAt}</div>}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="source-note"><Youtube size={18} /><div><b>Live metadata, official source.</b><span>Search details and thumbnails are displayed here. Playback and any creator rights stay with YouTube.</span></div><a href={youtubeSearchUrl(submittedQuery)} target="_blank" rel="noreferrer">Open YouTube <ExternalLink size={13} /></a></section>
      </main>

      <section className="now-playing" aria-label="Now playing">
        <div className="now-playing-top"><span className="live-dot" /> Now listening <span className="now-playing-line" /><span className="track-index">{String(Math.min(selectedTrack.id, displayedTracks.length || 1)).padStart(2, "0")} / {String(displayedTracks.length || 1).padStart(2, "0")}</span></div>
        <div className={`now-art bg-gradient-to-br ${selectedTrack.accent} ${selectedTrack.thumbnail ? "has-thumbnail" : ""}`}>
          {selectedTrack.videoId ? <iframe key={selectedTrack.videoId} ref={playerFrameRef} className="youtube-player" src={`https://www.youtube.com/embed/${encodeURIComponent(selectedTrack.videoId)}?autoplay=${isPlaying ? 1 : 0}&playsinline=1&enablejsapi=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`} title={`YouTube player for ${selectedTrack.title}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : selectedTrack.thumbnail ? <img className="now-art-image" src={selectedTrack.thumbnail} alt="" /> : <><div className="artwork-noise" /><span className="big-initials">{selectedTrack.initials}</span></>}
          {selectedTrack.videoId ? <div className="youtube-player-label">Official YouTube player · {isPlaying ? "Playing" : "Paused"}</div> : <><div className="artwork-shade" /><div className="now-art-overlay"><span>{selectedTrack.tone}</span><span>Search result</span></div></>}
        </div>
        <div className="now-copy"><span className="now-label">Selected track</span><h2>{selectedTrack.title}</h2><p>{selectedTrack.artist}</p></div>
        <div className="player-wave"><Visualizer active={isPlaying} /><div className="progress-line"><span /></div><div className="time-row"><span>00:00</span><span>{selectedTrack.duration}</span></div></div>
        <div className="player-controls"><button onClick={() => toast("Already at the top of this listening queue.")} aria-label="Previous track"><SkipBack size={18} fill="currentColor" /></button><button className="play-button" onClick={() => { if (selectedTrack.videoId) setIsPlaying(!isPlaying); else toast("Search for a live YouTube result first."); }} aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button onClick={() => toast("Next track is ready in the queue.")} aria-label="Next track"><SkipForward size={18} fill="currentColor" /></button></div>
        <div className="player-actions"><button onClick={saveSelectedTrack} className={liked ? "liked" : ""}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Saved" : "Save"}</button><button onClick={() => openOfficial(selectedTrack)}><Youtube size={16} /> Open source</button><span className="volume"><Volume2 size={15} /><span className="volume-track"><i /></span></span></div>
        <div className="player-disclaimer">Pause/resume controls the official YouTube player. Save adds the video to Soundwave favorites; it does not download an audio file.</div>
      </section>
    </div>
  );
}
