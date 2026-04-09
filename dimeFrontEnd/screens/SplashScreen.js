import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, BreeSerif_400Regular } from '@expo-google-fonts/bree-serif';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1.3)).current;
  const dimeOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({ BreeSerif_400Regular });

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(bgAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
      ]),
      Animated.delay(400),
      Animated.timing(dimeOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(buttonsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ffffff', '#e8f4fd'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.logoArea}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <CapitalOneLogo />
        </Animated.View>

        <Animated.Text
          style={[
            styles.dimeText,
            { opacity: dimeOpacity },
            fontsLoaded ? { fontFamily: 'BreeSerif_400Regular' } : {},
          ]}
        >
          DIME
        </Animated.Text>
      </View>

      <Animated.View style={[styles.buttonsArea, { opacity: buttonsOpacity }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Iniciar Sesión</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonOutline]}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.buttonText}>Registrarse</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function CapitalOneLogo() {
  return (
    <View style={styles.logoContainer}>
      <View style={styles.swooshContainer}>
        <View style={styles.swooshOuter} />
        <View style={styles.swooshInner} />
      </View>
      <View style={styles.logoTextRow}>
        <Text style={styles.logoCapital}>Capital</Text>
        <Text style={styles.logoOne}>One</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  swooshContainer: {
    width: 220,
    height: 60,
    marginBottom: 4,
    position: 'relative',
    alignItems: 'center',
  },
  swooshOuter: {
    position: 'absolute',
    top: 0,
    right: 10,
    width: 160,
    height: 50,
    borderTopRightRadius: 50,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 4,
    borderWidth: 0,
    backgroundColor: '#cc0000',
    transform: [{ rotate: '-8deg' }],
  },
  swooshInner: {
    position: 'absolute',
    top: 12,
    right: 20,
    width: 130,
    height: 30,
    borderTopRightRadius: 40,
    borderTopLeftRadius: 8,
    backgroundColor: '#1a1a2e',
    transform: [{ rotate: '-8deg' }],
  },
  logoTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  logoCapital: {
    fontSize: 38,
    fontWeight: '700',
    color: '#004a8f',
    letterSpacing: -1,
  },
  logoOne: {
    fontSize: 38,
    fontStyle: 'italic',
    fontWeight: '400',
    color: '#004a8f',
    letterSpacing: -1,
  },
  dimeText: {
    fontSize: 42,
    color: '#ffbd59',
    marginTop: 20,
    letterSpacing: 4,
  },
  buttonsArea: {
    width: '80%',
    gap: 16,
  },
  button: {
    backgroundColor: '#3a7bd5',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#3a7bd5',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonOutline: {
    backgroundColor: '#5b9fe8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
