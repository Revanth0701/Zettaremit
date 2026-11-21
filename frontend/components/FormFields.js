import React, { useState } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

export function FieldLabel({ children, required = false }) {
  return <Text style={{ color: '#4A5568', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>{children}{required && <Text style={{ color: '#C53030' }} accessibilityLabel=" required"> *</Text>}</Text>;
}

// Match the existing web SVG / native vector-view icon pattern without a new icon library.
export function FormIcon({ kind = 'document', hidden = false }) {
  const color = kind === 'eye' ? '#1A202C' : '#0047AB';
  if (Platform.OS === 'web') return <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color }}>
    {kind === 'eye' ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{hidden && <path d="m3 3 18 18"/>}</> : <><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="10" cy="10" r="2"/><path d="M7 16h10M14 9h3M14 12h3"/></>}
  </svg>;
  return <View accessible={false} style={{ width: 24, height: kind === 'eye' ? 16 : 24, borderWidth: 2, borderColor: color, borderRadius: kind === 'eye' ? 12 : 4, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }}/>{hidden && <View style={{ position: 'absolute', width: 27, height: 2, backgroundColor: color, transform: [{ rotate: '45deg' }] }}/>}</View>;
}

export function PasswordField({ label = 'Password', style, ...props }) {
  const [visible, setVisible] = useState(false);
  return <View>
    <FieldLabel required>{label}</FieldLabel>
    <View style={{ position: 'relative' }}>
      <TextInput placeholderTextColor="#A0AEC0" {...props} accessibilityLabel={label} aria-required={true} autoCapitalize="none" autoCorrect={false} secureTextEntry={!visible} style={[style, { paddingRight: 56 }]} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} accessibilityValue={{ text: visible ? 'Password visible' : 'Password hidden' }} onPress={() => setVisible(value => !value)} style={{ position: 'absolute', right: 2, top: 1, width: 48, height: 46, alignItems: 'center', justifyContent: 'center' }}>
        <FormIcon kind="eye" hidden={visible}/>
      </TouchableOpacity>
    </View>
  </View>;
}
