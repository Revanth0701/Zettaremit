import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getData } from 'country-list';
import { FieldLabel } from './FormFields';

const countries = getData().sort((a, b) => a.name.localeCompare(b.name));
export default function CountrySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => countries.filter(country => `${country.name} ${country.code}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const select = name => { onChange(name); setOpen(false); setQuery(''); };
  return <View style={{ marginBottom: 16 }}>
    <FieldLabel>Country of residence (optional)</FieldLabel>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Country of residence: ${value || 'Select country'}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 14 }}>
      <Text style={{ color: '#1A202C' }}>{value || 'Select country'}</Text>
    </TouchableOpacity>
    {open && <View style={{ borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 8, marginTop: 4 }}>
      <TextInput accessibilityLabel="Search countries by name or code" placeholder="Search countries" value={query} onChangeText={setQuery} autoFocus autoCapitalize="none" style={{ padding: 12, borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 6, marginBottom: 6 }} />
      {Platform.OS === 'web' ? <select aria-label="Country results" size={6} value={value} onChange={event => select(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && event.target.value) select(event.target.value); }} style={{ width: '100%', padding: 8, border: 0, font: 'inherit', color: '#1A202C', backgroundColor: 'white' }}>
        <option value="">Select country</option>
        {filtered.map(country => <option key={country.code} value={country.name}>{country.name}</option>)}
      </select> : <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">{filtered.map(country => <TouchableOpacity key={country.code} accessibilityRole="button" accessibilityLabel={country.name} onPress={() => select(country.name)} style={{ padding: 14 }}><Text>{country.name}</Text></TouchableOpacity>)}</ScrollView>}
      {!filtered.length && <Text accessibilityLiveRegion="polite" style={{ padding: 10 }}>No countries found. Try a country name or two-letter code.</Text>}
    </View>}
    {!!value && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear country selection" onPress={() => onChange('')} style={{ paddingVertical: 10 }}><Text style={{ color: '#0047AB' }}>Clear selection</Text></TouchableOpacity>}
  </View>;
}
