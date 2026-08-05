import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const SECTIONS = [
  {
    icon: 'database-outline',
    iconColor: '#007AFF',
    title: 'Data Source',
    content:
      'All trade disclosures are sourced from mandatory STOCK Act filings submitted to the U.S. House of Representatives Clerk and the U.S. Senate eFD system. These are public government records.',
  },
  {
    icon: 'update',
    iconColor: '#2E7D32',
    title: 'Update Frequency',
    content:
      'Our database is refreshed daily. New filings are automatically scraped and processed. Data typically becomes available within 24 hours of a new filing being publicly posted.',
  },
  {
    icon: 'clock-alert-outline',
    iconColor: '#E65100',
    title: 'Reporting Lag (Up to 45 Days)',
    content:
      'Under the STOCK Act, members of Congress must report transactions within 45 days of the actual trade date. This means a filing may appear in our app up to 45 days after the trade occurred.',
  },
  {
    icon: 'shield-check-outline',
    iconColor: '#6A0DAD',
    title: 'Data Accuracy',
    content:
      'Disclosures are extracted from official government PDFs. Occasional OCR or transcription errors may exist in the source documents. Always verify important information against the original filing before making any decisions.',
  },
  {
    icon: 'alert-outline',
    iconColor: '#C62828',
    title: 'Important Disclaimer',
    content:
      'Portrace is for informational and educational purposes only. Nothing in this app constitutes financial advice, investment recommendations, or a solicitation to buy or sell any security. Congressional trading data reflects delayed disclosures that may be amended or corrected. Always consult a qualified financial advisor and conduct your own research.',
  },
  {
    icon: 'file-document-outline',
    iconColor: '#374151',
    title: 'Official Sources',
    content: 'You can view original government filings directly:',
    links: [
      { label: 'House Financial Disclosures', url: 'https://disclosures-clerk.house.gov/PublicDisclosure/FinancialDisclosure' },
      { label: 'Senate eFD System',           url: 'https://efts.senate.gov/LATEST/search-index?q=%22stock%22' },
      { label: 'STOCK Act (Text)',             url: 'https://www.congress.gov/bill/112th-congress/senate-bill/2038' },
    ],
  },
];

export default function TransparencyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={styles.pageTitle}>Data Transparency</Text>
      <Text style={styles.pageSub}>
        We believe in complete transparency about our data sources, update cadence, and limitations.
      </Text>

      {SECTIONS.map((sec, idx) => (
        <View key={idx} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: sec.iconColor + '18' }]}>
              <Icon name={sec.icon} size={22} color={sec.iconColor} />
            </View>
            <Text style={styles.cardTitle}>{sec.title}</Text>
          </View>
          <Text style={styles.cardContent}>{sec.content}</Text>
          {sec.links && sec.links.map((link, li) => (
            <TouchableOpacity
              key={li}
              style={styles.linkRow}
              onPress={() => Linking.openURL(link.url)}
            >
              <Icon name="open-in-new" size={14} color="#007AFF" />
              <Text style={styles.linkText}> {link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <View style={styles.footerNote}>
        <Icon name="information-outline" size={15} color="#6B7280" />
        <Text style={styles.footerNoteText}>
          {' '}Portrace is not affiliated with the U.S. Congress, House of Representatives, or Senate.
          All data is derived from publicly available government disclosures.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F0F2F5' },
  pageTitle:      { fontSize: 24, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },
  pageSub:        { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconBox:        { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle:      { fontSize: 16, fontWeight: '700', color: '#1C1C1E', flex: 1, flexWrap: 'wrap' },
  cardContent:    { fontSize: 14, color: '#374151', lineHeight: 22 },
  linkRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  linkText:       { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  footerNote: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginTop: 6,
  },
  footerNoteText: { fontSize: 13, color: '#6B7280', flex: 1, lineHeight: 20 },
});
