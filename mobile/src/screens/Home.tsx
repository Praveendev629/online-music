import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { searchVideos } from '../api/client';
import { configureNativeCookies, getDownloadUrl, getStreamUrl, warmUpNative } from '../extractor';
import { colors } from '../theme';
import { downloadTrack, getDownloads, getLikes, removeDownload, saveLikes } from '../storage';
import type { DownloadedTrack, Video } from '../types';
import { NowPlaying } from '../components/NowPlaying';
import { ResultItem } from '../components/ResultItem';
import { SearchBar } from '../components/SearchBar';

export function Home() {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [downloads, setDownloads] = useState<DownloadedTrack[]>([]);

  const soundRef = useRef<Audio.Sound | null>(null);
  const selectedRef = useRef<Video | null>(null);
  const playlistRef = useRef<Video[]>([]);
  const nextRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true });
    getLikes().then(arr => setLikes(new Set(arr)));
    getDownloads().then(setDownloads);
    // Extract bundled Python/yt-dlp + refresh to latest STABLE up front so the
    // first search/playback isn't slow and survives YouTube's bot checks.
    // Cookies (if provided) must land before the warm-up runs.
    configureNativeCookies().then(() => warmUpNative());
    return () => {
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    playlistRef.current = videos;
  }, [videos]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const unloadSound = useCallback(async () => {
    const current = soundRef.current;
    soundRef.current = null;
    if (current) {
      await current.unloadAsync().catch(() => undefined);
    }
  }, []);

  const playTrack = useCallback(
    async (video: Video, shouldPlay: boolean) => {
      await unloadSound();
      setSelected(video);
      setSelectedRefNow(video);
      setIsLoading(true);
      setPlaybackError(null);
      try {
        const uri = await getStreamUrl(video.id);
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay, volume },
          status => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              setPositionMillis(status.positionMillis ?? 0);
              setDurationMillis(status.durationMillis ?? 0);
              if (status.didJustFinish) nextRef.current();
            }
          }
        );
        soundRef.current = sound;
        if (!shouldPlay) {
          await sound.pauseAsync().catch(() => undefined);
        }
      } catch (error) {
        console.error('Playback error:', error);
        const detail = error instanceof Error ? error.message : String(error);
        setPlaybackError(detail ? `Failed to play: ${detail.slice(0, 240)}` : 'Failed to load audio for this song.');
      } finally {
        setIsLoading(false);
      }
    },
    [unloadSound, volume]
  );

  function setSelectedRefNow(video: Video) {
    selectedRef.current = video;
  }

  const next = useCallback(() => {
    const list = playlistRef.current;
    const current = selectedRef.current;
    if (!list.length) return;
    const idx = current ? list.findIndex(v => v.id === current.id) : -1;
    const target = list[(idx + 1) % list.length];
    playTrack(target, true);
  }, [playTrack]);

  const prev = useCallback(() => {
    const list = playlistRef.current;
    const current = selectedRef.current;
    if (!list.length) return;
    const idx = current ? list.findIndex(v => v.id === current.id) : 0;
    const target = idx <= 0 ? list[list.length - 1] : list[idx - 1];
    playTrack(target, true);
  }, [playTrack]);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchVideos(query.trim());
      setVideos(results);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const togglePlay = useCallback(() => {
    const sound = soundRef.current;
    if (!sound) return;
    if (isPlaying) {
      sound.pauseAsync().catch(() => undefined);
    } else {
      sound.playAsync().catch(() => undefined);
    }
  }, [isPlaying]);

  const seekTo = useCallback((ms: number) => {
    setPositionMillis(ms);
    soundRef.current?.setPositionAsync(ms).catch(() => undefined);
  }, []);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    soundRef.current?.setVolumeAsync(v).catch(() => undefined);
  }, []);

  const toggleLike = useCallback(
    async (video: Video) => {
      const wasLiked = likes.has(video.id);
      const nextLikes = new Set(likes);
      if (wasLiked) {
        nextLikes.delete(video.id);
      } else {
        nextLikes.add(video.id);
      }
      setLikes(nextLikes);
      await saveLikes([...nextLikes]);
    },
    [likes]
  );

  const handleDownload = useCallback(
    async (video: Video) => {
      try {
        const url = await getDownloadUrl(video.id, video.title);
        const track = await downloadTrack(video.id, video.title, video.author, url);
        setDownloads(prev => [track, ...prev.filter(t => t.id !== track.id)]);
      } catch (error) {
        console.error('Download error:', error);
        const detail = error instanceof Error ? error.message : String(error);
        setPlaybackError(detail ? `Download failed: ${detail.slice(0, 240)}` : 'Download failed for this song.');
      }
    },
    []
  );

  const playDownloaded = useCallback(
    (track: DownloadedTrack) => {
      playTrack(
        { id: track.id, title: track.title, author: track.author, thumbnail: '', duration: '', views: '' },
        true
      ).catch(() => {
        // local file may be missing
        setPlaybackError('Downloaded file is missing.');
      });
    },
    [playTrack]
  );

  const deleteDownload = useCallback(
    async (id: string) => {
      await removeDownload(id);
      setDownloads(prev => prev.filter(t => t.id !== id));
    },
    []
  );

  return (
    <FlatList
      style={styles.list}
      data={videos}
      keyExtractor={item => item.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <SearchBar value={query} onChange={setQuery} onSubmit={handleSearch} loading={isSearching} />

          {searchError ? (
            <Text style={styles.error}>{searchError}</Text>
          ) : null}
          {playbackError ? <Text style={styles.error}>{playbackError}</Text> : null}

          <Text style={styles.section}>
            {videos.length > 0 ? `Results (${videos.length})` : 'Search for songs'}
          </Text>

          {selected ? (
            <NowPlaying
              video={selected}
              isPlaying={isPlaying}
              isLoading={isLoading}
              positionMillis={positionMillis}
              durationMillis={durationMillis}
              volume={volume}
              isLiked={likes.has(selected.id)}
              isDownloaded={downloads.some(d => d.id === selected.id)}
              onTogglePlay={togglePlay}
              onNext={next}
              onPrev={prev}
              onSeek={seekTo}
              onVolume={changeVolume}
              onLike={() => toggleLike(selected)}
              onDownload={() => handleDownload(selected)}
              onClose={() => unloadSound()}
            />
          ) : (
            <Text style={styles.hint}>Pick a song to start playing.</Text>
          )}

          {downloads.length > 0 ? (
            <View style={styles.downloads}>
              <Text style={styles.section}>Downloads</Text>
              {downloads.map(track => (
                <View key={track.id} style={styles.downloadRow}>
                  <Pressable style={styles.downloadPlay} onPress={() => playDownloaded(track)}>
                    <Text style={styles.downloadText} numberOfLines={1}>
                      {track.title}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => deleteDownload(track.id)} hitSlop={8}>
                    <Text style={styles.deleteText}>delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <ResultItem
          video={item}
          isActive={selected?.id === item.id}
          isLiked={likes.has(item.id)}
          isDownloaded={downloads.some(d => d.id === item.id)}
          onSelect={() => playTrack(item, true)}
          onLike={() => toggleLike(item)}
          onDownload={() => handleDownload(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.bg
  },
  section: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 10
  },
  hint: {
    color: colors.muted,
    marginVertical: 8
  },
  error: {
    color: colors.danger,
    marginBottom: 8
  },
  downloads: {
    marginTop: 8,
    marginBottom: 16
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6
  },
  downloadPlay: {
    flex: 1
  },
  downloadText: {
    color: colors.text,
    fontSize: 14
  },
  deleteText: {
    color: colors.muted,
    fontSize: 12,
    marginLeft: 10
  }
});