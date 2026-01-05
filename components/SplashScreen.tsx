import React, { useEffect } from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated';

interface SplashScreenProps {
  onGetStarted: () => void;
}

export const SplashScreen = ({ onGetStarted }: SplashScreenProps) => {
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.98);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(15);

  useEffect(() => {
    // Smooth, elegant entrance
    titleOpacity.value = withTiming(1, { duration: 1500 });
    titleScale.value = withTiming(1, { duration: 1500 });
    
    buttonOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    buttonTranslateY.value = withDelay(1000, withTiming(0, { duration: 800 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.centerContent}>
        <Animated.View style={[styles.brandWrapper, titleStyle]}>
          <Text style={styles.brandName}>
            BACK<Text style={styles.brandSerif}>CHANNEL</Text>
          </Text>
          
          <View style={styles.horizontalRule} />
          
          <Text style={styles.tagline}>
            Get referred. Get hired. Get ahead.
          </Text>
        </Animated.View>
      </View>

      <SafeAreaView style={styles.footer}>
        <Animated.View style={[styles.buttonContainer, buttonStyle]}>
          <TouchableOpacity 
            activeOpacity={0.85} 
            onPress={onGetStarted} 
            style={styles.button}
          >
            <Text style={styles.buttonText}>Get Connected</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandWrapper: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 34,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 6, // High-end spacing
  },
  brandSerif: {
    // Professional Serif contrast
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  horizontalRule: {
    width: 28,
    height: 1.5,
    backgroundColor: '#333',
    marginVertical: 24,
  },
  tagline: {
    fontSize: 15,
    color: '#999999',
    fontWeight: '400',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 60,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '65%', 
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    // Elegant shadow for depth
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 60,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});