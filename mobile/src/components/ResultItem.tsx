import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { Video } from '../types';

interface Props {
  video: Video;
  isActive: boolean;
  isLiked: boolean;
  isDownloaded: boolean;
  onSelect: () => void;
  onLike: () => void;
  onDownload: () => void;
}

export function ResultItem({ video, isActive, isLiked, isDownloaded, onSelect, onLike, onDownload }: Props) {
  return (
    <Pressable onPress={onSelect} style={[styles.card, isActive && styles.cardActive]}>
      <Image source={{ uri: video.thumbnail }} style={styles.thumb} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {video.author}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {video.duration} • {video.views} views
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 12,
    marginBottom: 10
  },
  cardActive: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderColor: colors.purple
  },
  thumb: {
    width: 96,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.card
  },
  info: {
    flex: 1,
    marginHorizontal: 12,
    justifyContent: 'center'
  },
  title: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14
  },
  author: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2
  },
  metaRow: {
    marginTop: 2
  },
  meta: {
    color: '#6b7280',
    fontSize: 11
  },
  actions: {
    justifyContent: 'center',
    gap: 14
  }
});