import React, { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

const { width, height } = Dimensions.get('window');

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Show loading text after video ends
    if (videoEnded) {
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();

      // Fade out splash after brief pause
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }).start(() => {
          setShowSplash(false);
        });
      }, 1200);
    }
  }, [videoEnded]);

  const handleVideoPlaybackStatus = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      setVideoEnded(true);
    }
  };

  // Fallback: if video fails to load, transition after timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!videoEnded) {
        setVideoEnded(true);
      }
    }, 10000); // Max 10 seconds for splash

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {showSplash ? (
        <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
          {!videoEnded ? (
            <View style={styles.videoContainer}>
              <Video
                source={require('../assets/splash-video.mp4')}
                style={styles.splashVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={false}
                isMuted={false}
                onPlaybackStatusUpdate={handleVideoPlaybackStatus}
                onError={() => setVideoEnded(true)}
              />
            </View>
          ) : (
            <View style={styles.transitionContainer}>
              <Animated.Text style={[styles.loadingText, { opacity: textOpacity }]}>
                Initializing Creative Studio...
              </Animated.Text>
            </View>
          )}
        </Animated.View>
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade_from_bottom',
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  splashVideo: {
    width: width,
    height: height,
  },
  transitionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a12',
  },
  loadingText: {
    fontSize: 16,
    color: '#8b5cf6',
    letterSpacing: 1,
    fontWeight: '500',
  },
});
