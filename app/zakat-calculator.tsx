import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Share, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import {
  calculateZakat, formatMoney, EMPTY_ASSETS, EMPTY_LIABILITIES, DEFAULT_PRICES,
  NISAB_GRAMS, NisabBasis, ZakatAssets, ZakatLiabilities, ZakatPrices,
} from '../lib/zakat';

/**
 * Zakat calculator.
 *
 * Zakat is one of the five pillars, and the app covered the other four
 * (shahada via the guide, salah via the tracker, sawm via Ramadan, hajj via the
 * guide) but had no way to work out what is owed. This screen does the
 * arithmetic locally — nothing is uploaded — and explains every step.
 */

interface MoneyFieldProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  color: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  surfaceColor: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
}

function MoneyField({
  label, hint, value, onChange, color, textColor, mutedColor, borderColor, surfaceColor, icon,
}: MoneyFieldProps) {
  const [text, setText] = useState(value > 0 ? String(value) : '');

  const handleChange = (raw: string) => {
    // Keep digits and a single decimal separator.
    const cleaned = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setText(cleaned);
    onChange(Number(cleaned) || 0);
  };

  return (
    <View style={[styles.field, { borderBottomColor: borderColor }]}>
      <View style={styles.fieldLabelRow}>
        {icon ? <MaterialIcons name={icon} size={16} color={color} /> : null}
        <Text style={[styles.fieldLabel, { color: textColor }]}>{label}</Text>
      </View>
      {hint ? <Text style={[styles.fieldHint, { color: mutedColor }]}>{hint}</Text> : null}
      <TextInput
        value={text}
        onChangeText={handleChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={mutedColor}
        style={[styles.input, { color: textColor, backgroundColor: surfaceColor, borderColor }]}
      />
    </View>
  );
}

export default function ZakatCalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();

  const [assets, setAssets] = useState<ZakatAssets>(EMPTY_ASSETS);
  const [liabilities, setLiabilities] = useState<ZakatLiabilities>(EMPTY_LIABILITIES);
  const [prices, setPrices] = useState<ZakatPrices>(DEFAULT_PRICES);
  const [basis, setBasis] = useState<NisabBasis>('silver');
  const [showExplanation, setShowExplanation] = useState(true);

  const setAsset = <K extends keyof ZakatAssets>(key: K) => (value: number) =>
    setAssets(prev => ({ ...prev, [key]: value }));
  const setLiability = <K extends keyof ZakatLiabilities>(key: K) => (value: number) =>
    setLiabilities(prev => ({ ...prev, [key]: value }));

  const result = useMemo(
    () => calculateZakat(assets, liabilities, prices, basis),
    [assets, liabilities, prices, basis],
  );

  const nisabReady = basis === 'gold' ? prices.goldPerGram > 0 : prices.silverPerGram > 0;
  const hasAssets = result.grossAssets > 0;

  const shareSummary = async () => {
    const lines = [
      'Zakat Calculation',
      '─────────────────',
      `Gross assets: ${formatMoney(result.grossAssets)}`,
      `Liabilities: ${formatMoney(result.liabilities)}`,
      `Net wealth: ${formatMoney(result.netWealth)}`,
      `Nisab (${basis}): ${formatMoney(result.nisabValue)}`,
      result.isEligible
        ? `Zakat due (2.5%): ${formatMoney(result.zakatDue)}`
        : 'Zakat due: not applicable (below nisab)',
      '',
      'Calculated with IslamicGuide',
    ];
    await Share.share({ message: lines.join('\n') });
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: C.cardBorder }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Zakat Calculator</Text>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>2.5% of wealth above nisab</Text>
        </View>
        <Pressable onPress={shareSummary} style={styles.backBtn}>
          <MaterialIcons name="share" size={20} color={C.gold} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* Result card */}
        <LinearGradient
          colors={[C.primaryDark, C.primary]}
          style={styles.resultCard}
        >
          <Text style={[styles.resultLabel, { color: `${C.gold}CC` }]}>Zakat due</Text>
          <Text style={[styles.resultValue, { color: C.gold }]}>
            {result.isEligible ? formatMoney(result.zakatDue) : '—'}
          </Text>
          <Text style={[styles.resultNote, { color: `${C.textPrimary}BB` }]}>
            {!nisabReady
              ? 'Enter today’s gold or silver price to check the nisab.'
              : result.isEligible
                ? `Your net wealth exceeds the ${basis} nisab of ${formatMoney(result.nisabValue)}.`
                : `Below the ${basis} nisab of ${formatMoney(result.nisabValue)} — no zakat is due.`}
          </Text>

          <View style={[styles.resultRow, { borderTopColor: `${C.textPrimary}20` }]}>
            <View style={styles.resultMini}>
              <Text style={[styles.resultMiniLabel, { color: `${C.textPrimary}88` }]}>Gross assets</Text>
              <Text style={[styles.resultMiniValue, { color: C.textPrimary }]}>{formatMoney(result.grossAssets)}</Text>
            </View>
            <View style={styles.resultMini}>
              <Text style={[styles.resultMiniLabel, { color: `${C.textPrimary}88` }]}>Liabilities</Text>
              <Text style={[styles.resultMiniValue, { color: C.textPrimary }]}>{formatMoney(result.liabilities)}</Text>
            </View>
            <View style={styles.resultMini}>
              <Text style={[styles.resultMiniLabel, { color: `${C.textPrimary}88` }]}>Net wealth</Text>
              <Text style={[styles.resultMiniValue, { color: C.textPrimary }]}>{formatMoney(result.netWealth)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Nisab basis */}
        <Text style={[styles.sectionTitle, { color: C.textMuted }]}>NISAB BASIS</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={styles.basisRow}>
            {(['silver', 'gold'] as NisabBasis[]).map(option => (
              <Pressable
                key={option}
                onPress={() => setBasis(option)}
                style={[
                  styles.basisBtn,
                  { borderColor: basis === option ? C.gold : C.cardBorder, backgroundColor: basis === option ? `${C.gold}18` : 'transparent' },
                ]}
              >
                <Text style={[styles.basisTitle, { color: basis === option ? C.gold : C.textPrimary }]}>
                  {option === 'silver' ? 'Silver' : 'Gold'}
                </Text>
                <Text style={[styles.basisSub, { color: C.textMuted }]}>
                  {option === 'silver' ? `${NISAB_GRAMS.silver} g` : `${NISAB_GRAMS.gold} g`}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.basisNote, { color: C.textMuted }]}>
            The silver nisab is lower, so it is the safer choice and includes more people in zakat.
          </Text>
        </View>

        {/* Metal prices */}
        <Text style={[styles.sectionTitle, { color: C.textMuted }]}>TODAY’S METAL PRICES</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder, paddingTop: 0 }]}>
          <MoneyField
            label="Gold price per gram"
            hint="24k — check your local market rate"
            value={prices.goldPerGram}
            onChange={v => setPrices(p => ({ ...p, goldPerGram: v }))}
            color={C.gold}
            textColor={C.textPrimary}
            mutedColor={C.textMuted}
            borderColor={C.cardBorder}
            surfaceColor={C.surfaceElevated}
          />
          <MoneyField
            label="Silver price per gram"
            value={prices.silverPerGram}
            onChange={v => setPrices(p => ({ ...p, silverPerGram: v }))}
            color={C.info}
            textColor={C.textPrimary}
            mutedColor={C.textMuted}
            borderColor={C.cardBorder}
            surfaceColor={C.surfaceElevated}
          />
          <Text style={[styles.priceNote, { color: C.textMuted }]}>
            Prices are not fetched automatically — zakat must be based on the rate on the day you pay.
          </Text>
        </View>

        {/* Assets */}
        <Text style={[styles.sectionTitle, { color: C.textMuted }]}>ZAKATABLE ASSETS</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder, paddingTop: 0 }]}>
          <MoneyField
            label="Cash in hand"
            value={assets.cash}
            onChange={setAsset('cash')}
            color={C.gold} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
          <MoneyField
            label="Bank accounts"
            hint="Current & savings balances"
            value={assets.bankAccounts}
            onChange={setAsset('bankAccounts')}
            color={C.gold} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
          <MoneyField
            label="Gold owned (grams)"
            hint="Jewellery in regular use is debated — ask a scholar"
            value={assets.goldGrams}
            onChange={setAsset('goldGrams')}
            color={C.gold} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
          <MoneyField
            label="Silver owned (grams)"
            value={assets.silverGrams}
            onChange={setAsset('silverGrams')}
            color={C.gold} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
          <MoneyField
            label="Investments & shares"
            hint="Value of liquid investments"
            value={assets.investments}
            onChange={setAsset('investments')}
            color={C.gold} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
          <MoneyField
            label="Business stock"
            hint="Goods held for sale at market value"
            value={assets.businessStock}
            onChange={setAsset('businessStock')}
            color={C.gold} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
          <MoneyField
            label="Money owed to you"
            hint="Debts you expect to be repaid"
            value={assets.moneyOwedToYou}
            onChange={setAsset('moneyOwedToYou')}
            color={C.gold} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
        </View>

        {/* Liabilities */}
        <Text style={[styles.sectionTitle, { color: C.textMuted }]}>DEBTS & DUES</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder, paddingTop: 0 }]}>
          <MoneyField
            label="Debts you owe"
            hint="Amounts due now, not the whole mortgage"
            value={liabilities.debts}
            onChange={setLiability('debts')}
            color={C.error} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
          <MoneyField
            label="Bills due immediately"
            value={liabilities.billsDue}
            onChange={setLiability('billsDue')}
            color={C.error} textColor={C.textPrimary} mutedColor={C.textMuted}
            borderColor={C.cardBorder} surfaceColor={C.surfaceElevated}
          />
        </View>

        {/* Breakdown */}
        <Text style={[styles.sectionTitle, { color: C.textMuted }]}>BREAKDOWN</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder, paddingVertical: 4 }]}>
          {result.breakdown.filter(row => row.value > 0).map(row => (
            <View key={row.key} style={[styles.breakRow, { borderBottomColor: C.divider }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.breakLabel, { color: C.textPrimary }]}>{row.label}</Text>
                {row.detail ? <Text style={[styles.breakDetail, { color: C.textMuted }]}>{row.detail}</Text> : null}
              </View>
              <Text style={[styles.breakValue, { color: C.textSecondary }]}>{formatMoney(row.value)}</Text>
            </View>
          ))}
          {!hasAssets && (
            <Text style={[styles.emptyNote, { color: C.textMuted }]}>
              Enter your assets above to see the breakdown.
            </Text>
          )}
        </View>

        {/* Explanation */}
        <Pressable
          style={[styles.explainToggle, { borderColor: C.cardBorder }]}
          onPress={() => setShowExplanation(v => !v)}
        >
          <MaterialIcons name={showExplanation ? 'expand-less' : 'expand-more'} size={20} color={C.gold} />
          <Text style={[styles.explainTitle, { color: C.textPrimary }]}>How zakat is calculated</Text>
          <Switch
            value={showExplanation}
            onValueChange={setShowExplanation}
            trackColor={{ true: `${C.gold}80`, false: C.cardBorder }}
            thumbColor={showExplanation ? C.gold : C.textMuted}
          />
        </Pressable>

        {showExplanation && (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.explainText, { color: C.textSecondary }]}>
              1. Add every zakatable asset: cash, bank balances, the current value of gold and silver,
              investments, business stock and money owed to you.
            </Text>
            <Text style={[styles.explainText, { color: C.textSecondary }]}>
              2. Subtract debts and bills that are due now. The remainder is your net zakatable wealth.
            </Text>
            <Text style={[styles.explainText, { color: C.textSecondary }]}>
              3. Compare it with the nisab — 87.48 g of gold or 612.36 g of silver. If your wealth has
              stayed above it for one lunar year, zakat is due.
            </Text>
            <Text style={[styles.explainText, { color: C.textSecondary }]}>
              4. Pay 2.5% (one fortieth) of that wealth to those eligible: the poor, the needy, those in
              debt and the other categories named in Quran 9:60.
            </Text>
            <View style={[styles.ayaBox, { backgroundColor: `${C.primary}20`, borderColor: `${C.gold}25` }]}>
              <Text style={[styles.ayaArabic, { color: C.textArabic }]}>
                خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا
              </Text>
              <Text style={[styles.ayaTranslation, { color: C.textSecondary }]}>
                “Take from their wealth a charity by which you purify them and cause them increase.”
                — Quran 9:103
              </Text>
            </View>
            <Text style={[styles.disclaimer, { color: C.textMuted }]}>
              This tool is a guide, not a fatwa. For complex cases (property, pensions, business assets)
              consult a qualified scholar.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  resultCard: { margin: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  resultLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  resultValue: { fontSize: 34, fontWeight: '800', marginTop: 6 },
  resultNote: { fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 17 },
  resultRow: { flexDirection: 'row', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, width: '100%' },
  resultMini: { flex: 1, alignItems: 'center' },
  resultMiniLabel: { fontSize: 10 },
  resultMiniValue: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 6 },
  card: { marginHorizontal: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  basisRow: { flexDirection: 'row', gap: 10 },
  basisBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5 },
  basisTitle: { fontSize: 14, fontWeight: '700' },
  basisSub: { fontSize: 11, marginTop: 2 },
  basisNote: { fontSize: 11, marginTop: Spacing.sm, lineHeight: 16 },
  field: { paddingTop: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  fieldHint: { fontSize: 11, marginTop: 2 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  priceNote: { fontSize: 11, marginTop: Spacing.sm, lineHeight: 16 },
  breakRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  breakLabel: { fontSize: 13, fontWeight: '500' },
  breakDetail: { fontSize: 11, marginTop: 2 },
  breakValue: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  emptyNote: { fontSize: 12, paddingVertical: Spacing.md, textAlign: 'center' },
  explainToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  explainTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  explainText: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  ayaBox: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.sm },
  ayaArabic: { fontSize: 19, lineHeight: 34, textAlign: 'right' },
  ayaTranslation: { fontSize: 12, lineHeight: 18, marginTop: Spacing.sm },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: Spacing.md, fontStyle: 'italic' },
});
