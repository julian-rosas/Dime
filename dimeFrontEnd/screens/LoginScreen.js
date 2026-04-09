import React, { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { login } from '../services/api';

export default function LoginScreen({ navigation, onAuthenticated }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Escribe tu correo o teléfono y tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await login({
        identifier: identifier.trim(),
        password,
      });

      onAuthenticated({
        ...result,
        entryPoint: 'login',
      });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Iniciar Sesión</Text>

        <Text style={styles.label}>Correo o Teléfono</Text>
        <TextInput
          style={styles.input}
          placeholder="julian@example.com o +525512345678"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          value={identifier}
          onChangeText={setIdentifier}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Sesión</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f6ff',
    paddingHorizontal: 28,
    paddingTop: 60,
  },
  back: {
    marginBottom: 24,
  },
  backText: {
    color: '#3a7bd5',
    fontSize: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 36,
  },
  label: {
    fontSize: 16,
    color: '#444',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dde4f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a2e',
  },
  button: {
    backgroundColor: '#3a7bd5',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 36,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: '#d62839',
    marginTop: 16,
    fontSize: 16,
  },
});
