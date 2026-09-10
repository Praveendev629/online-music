import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { Video } from '../types';

interface Props {
  video: Video;
  isPlaying: boolean;
  isLoading: boolean;
  positionMillis: number;
  durationMillis: number;
  volume: number;
  isLiked: boolean;
  isDownloaded: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (ms: number) => void;
  onVolume: (v: number) => void;
  onLike: () => void;
  onDownload: () => void;
  onClose: () => void;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NowPlaying(props: Props) {
  const {
    video,
    isPlaying,
    isLoading,
    positionMillis,
    durationMillis,
    volume,
    isLiked,
    isDownloaded,
    onTogglePlay,
    onNext,
    onPrev,
    onSeek,
    onVolume,
    onLike,
    onDownload,
    onClose
  } = props;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Now Playing</Text>
      <Image source={{ uri: video.thumbnail }} style={styles.art} />
      <View style={styles.titleRow}>
        <View style={styles.titleInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {video.author}
          </Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable onPress={onDownload} hitSlop={8}>
            <Ionicons
              name={isDownloaded ? 'checkmark-circle' : 'download-outline'}
              size={22}
              color={isDownloaded ? '#4ade80' : colors.muted}
            />
          </Pressable>
          <Pressable onPress={onLike} hitSlop={8}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={isLiked ? '#ef4444' : colors.muted}
            />
          </Pressable>
        </View>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={durationMillis || 1}
        value={Math.min(positionMillis, durationMillis || 0)}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={colors.purple}
        maximumTrackTintColor="#4b5563"
        thumbTintColor={colors.purple}
      />
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(positionMillis)}</Text>
        <Text style={styles.time}>{formatTime(durationMillis)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={onPrev} hitSlop={10}>
          <Ionicons name="play-skip-back" size={26} color={colors.text} />
        </Pressable>
        <Pressable onPress={onTogglePlay} style={styles.playButton}>
          {isLoading ? (
            <Ionicons name="sync" size={30} color="#111" />
          ) : isPlaying ? (
            <Ionicons name="pause" size={32} color="#111" />
          ) : (
            <Ionicons name="play" size={32} color="#111" />
          )}
        </Pressable>
        <Pressable onPress={onNext} hitSlop={10}>
          <Ionicons name="play-skip-forward" size={26} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.volumeRow}>
        <Ionicons name="volume-low" size={18} color={colors.muted} />
        <Slider
          style={styles.volumeSlider}
          minimumValue={0}
          maximumValue={1}
          value={volume}
          onValueChange={onVolume}
          minimumTrackTintColor={colors.purple}
          maximumTrackTintColor="#4b5563"
          thumbTintColor={colors.purple}
        />
        <Ionicons name="volume-high" size={18} color={colors.muted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16
  },
  heading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12
  },
  art: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: colors.bg
  },
  titleRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 8
  },
  titleInfo: {
    flex: 1,
    paddingRight: 8
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  author: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2
  },
  rowActions: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center'
  },
  slider: {
    marginTop: 4,
    height: 30
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  time: {
    color: colors.muted,
    fontSize: 11
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    marginVertical: 14
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  volumeSlider: {
    flex: 1,
    height: 28
  }
});