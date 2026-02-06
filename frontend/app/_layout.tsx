import React, { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Animated, Dimensions, Image, Text } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

const { width, height } = Dimensions.get('window');

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Show logo animation after video
    if (videoEnded) {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Fade out splash after logo animation
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start(() => {
          setShowSplash(false);
        });
      }, 1500);
    }
  }, [videoEnded]);

  const handleVideoPlaybackStatus = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      setVideoEnded(true);
    }
  };

  // Fallback: if video fails to load, show splash anyway and transition
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!videoEnded) {
        setVideoEnded(true);
      }
    }, 8000); // Max 8 seconds for splash

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {showSplash ? (
        <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
          {!videoEnded ? (
            <Video
              source={require('../assets/splash-video.mp4')}
              style={styles.splashVideo}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping={false}
              isMuted={false}
              onPlaybackStatusUpdate={handleVideoPlaybackStatus}
              onError={() => setVideoEnded(true)}
            />
          ) : (
            <View style={styles.logoContainer}>
              <Animated.Image
                source={require('../assets/images/lyricsinmotion-logo.jpg')}
                style={[
                  styles.splashLogo,
                  {
                    opacity: logoOpacity,
                    transform: [{ scale: logoScale }],
                  },
                ]}
                resizeMode="contain"
              />
              <Animated.Text style={[styles.loadingText, { opacity: logoOpacity }]}>
                Loading your creative studio...
              </Animated.Text>
            </View>
          )}
        </Animated.View>
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0a0a12' },
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
    backgroundColor: '#0a0a12',
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashVideo: {
    width: width,
    height: height,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a12',
  },
  splashLogo: {
    width: width * 0.85,
    height: height * 0.4,
    maxWidth: 400,
    maxHeight: 300,
  },
  loadingText: {
    marginTop: 30,
    fontSize: 14,
    color: '#8b5cf6',
    letterSpacing: 1,
  },
});
