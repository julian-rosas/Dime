import React, { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { signup } from '../services/api';

export default function RegisterScreen({ navigation, onAuthenticated }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!password.trim() || password.trim().length < 8) {
      setError('Escribe una contraseña de al menos 8 caracteres.');
      return;
    }

    if (!email.trim() && !phone.trim()) {
      setError('Necesitas capturar un correo o un teléfono.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await signup({
        displayName: displayName.trim() || 'Usuario Dime',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
      });

      onAuthenticated({
        ...result,
        entryPoint: 'signup',
      });
    } catch (err) {
      setError(err.message || 'No se pudo completar el registro.');
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

        <Text style={styles.title}>Registrar</Text>

        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          placeholder="Tu nombre"
          placeholderTextColor="#aaa"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>Correo</Text>
        <TextInput
          style={styles.input}
          placeholder="julian@example.com"
          placeholderTextColor="#aaa"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Número de Teléfono</Text>
        <TextInput
          style={styles.input}
          placeholder="+525512345678"
          placeholderTextColor="#aaa"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
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
          onPress={handleSignup}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Registrar</Text>
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
