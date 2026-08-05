import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import UseAppStore from '../store/UseAppStore';

const SLIDES = [
  {
    key: '1',
    icon: 'bank',
    iconColor: '#007AFF',
    title: 'Track Congress Trades',
    subtitle:
      'See every stock purchase and sale reported by US senators and representatives — updated automatically.',
  },
  {
    key: '2',
    icon: 'signal-cellular-3',
    iconColor: '#2E7D32',
    title: 'Congress Signal Score',
    subtitle:
      'Our unique algorithm scores each stock 0–100 based on insider trade frequency, recency, and buy/sell ratio — giving you a clear signal at a glance.',
  },
  {
    key: '3',
    icon: 'star-circle-outline',
    iconColor: '#E65100',
    title: 'Build Your Watchlist',
    subtitle:
      'Save stocks to follow and track congressional activity alongside real-time price charts and analyst recommendations.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const setHasSeenOnboarding = UseAppStore((s) => s.setHasSeenOnboarding);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);
  const { width } = Dimensions.get('window');

  const goTo = (index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      goTo(activeIndex + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    setHasSeenOnboarding(true);
    navigation.replace('Home');
  };

  return (
    <View style={styles.container}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipButton} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconCircle, { borderColor: item.iconColor }]}>
              <Icon name={item.icon} size={72} color={item.iconColor} />
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)}>
            <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Next / Get Started */}
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextText}>
          {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
        </Text>
        <Icon name="arrow-right" size={20} color="#fff" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    paddingBottom: 48,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  skipText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingTop: 40,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 44,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 20,
  },
  slideSubtitle: {
    fontSize: 17,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 26,
  },
  dotsRow: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: '#007AFF',
    width: 28,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 16,
  },
  nextText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
