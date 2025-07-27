import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

// Categories with optional nested sub-items
const categories = [
  {
    label: 'Item 1',
    value: '1',
    icon: 'albums-outline',
    subItems: [
      { label: 'Subitem 1-1', value: '1-1' },
      { label: 'Subitem 1-2', value: '1-2' },
    ],
  },
  { label: 'Item 2', value: '2', icon: 'alarm-outline' },
  { label: 'Item 3', value: '3', icon: 'aperture-outline' },
  { label: 'Item 4', value: '4', icon: 'apps-outline' },
];

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomDrawerComponent(props) {
  const [expanded, setExpanded] = useState(false); // Categories dropdown
  const [expandedSubItems, setExpandedSubItems] = useState({}); // Which category sub-items are open
  const [selected, setSelected] = useState(null);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const toggleSubItems = (value) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSubItems(prev => ({
      ...prev,
      [value]: !prev[value],
    }));
  };

  const onSelectCategory = (item) => {
    setSelected(item.value);
    // Example: navigate or close drawer here if needed
    // props.navigation.navigate('SomeScreen', { category: item.value });
    // props.navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView {...props}>
      {/* Categories header */}
      <TouchableOpacity
        onPress={toggleExpand}
        style={[styles.drawerItem, expanded && styles.expandedHeader]}
        activeOpacity={0.7}
      >
        <View style={styles.iconLabelContainer}>
          <Ionicons name="grid-outline" size={22} color="black" style={styles.icon} />
          <Text style={styles.label}>Categories</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={20}
          color="black"
          style={styles.arrowIcon}
        />
      </TouchableOpacity>

      {/* Categories sub-items */}
      {expanded && (
        <View style={styles.itemsContainer}>
          {categories.map(item => {
  const hasSubItems = !!item.subItems?.length;
  const isSubExpanded = expandedSubItems[item.value];

  return (
    <View key={item.value}>
      <TouchableOpacity
        onPress={() => {
          if (hasSubItems) {
            toggleSubItems(item.value);
          } else {
            onSelectCategory(item);
          }
        }}
        style={[
          styles.drawerItem,
          selected === item.value && styles.selectedItem,
          styles.subItem,
          hasSubItems && styles.hasSubItems,
          isSubExpanded && styles.expandedHeader, // this line added
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.iconLabelContainer}>
          <Ionicons
            name={item.icon}
            size={20}
            color={selected === item.value ? '#007AFF' : 'black'}
            style={styles.icon}
          />
          <Text
            style={[styles.label, selected === item.value && styles.selectedText]}
          >
            {item.label}
          </Text>
        </View>
        {hasSubItems && (
          <Ionicons
            name={isSubExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={20}
            color="black"
            style={styles.arrowIcon}
          />
        )}
      </TouchableOpacity>

      {/* Nested sub-items */}
      {hasSubItems && isSubExpanded && (
        <View style={styles.nestedItemsContainer}>
          {item.subItems.map(subItem => (
            <TouchableOpacity
              key={subItem.value}
              onPress={() => onSelectCategory(subItem)}
              style={[
                styles.drawerItem,
                styles.nestedSubItem,
                selected === subItem.value && styles.selectedItem,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.label,
                  selected === subItem.value && styles.selectedText,
                ]}
              >
                {subItem.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
})}

        </View>
      )}
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  expandedHeader: {
    backgroundColor: '#f0f0f0',
  },
  iconLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 20,
  },
  arrowIcon: {
    marginLeft: 'auto',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
  },
  itemsContainer: {
    paddingLeft: 8,
  },
  subItem: {
    justifyContent: 'flex-start',
    marginVertical: 4,
  },
  hasSubItems: {
    // Optional: add styles for items with sub-items
  },
  nestedItemsContainer: {
    paddingLeft: 24,
  },
  nestedSubItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'flex-start',
    marginVertical: 2,
    borderRadius: 6,
  },
  selectedItem: {
    backgroundColor: '#e6f0ff',
  },
  selectedText: {
    fontWeight: '700',
    color: '#007AFF',
  },
});

[
  {
    "name": "Diagnostic Instruments",
    "subcategories": [
      "Mouth Mirror",
      "Explorer",
      "Periodontal Probe",
      "Cotton Pliers",
      "Tweezers"
    ]
  },
  {
    "name": "Restorative Instruments",
    "subcategories": [
      "Amalgam Carrier",
      "Burnisher",
      "Condenser (Plugger)",
      "Matrix Band Retainer",
      "Wedge",
      "Composite Instrument",
      "Excavator",
      "Plastic Filling Instrument"
    ]
  },
  {
    "name": "Endodontic Instruments",
    "subcategories": [
      "K-Files",
      "H-Files",
      "Gutta Percha Points",
      "Paper Points",
      "Rubber Dam Frame",
      "Rubber Dam Punch",
      "Rubber Dam Clamp",
      "Endo Excavator",
      "Apex Locator",
      "Endo Ruler"
    ]
  },
  {
    "name": "Orthodontic Instruments",
    "subcategories": [
      "Brackets",
      "Archwires",
      "Ligature Ties",
      "Separators",
      "Bird Beak Pliers",
      "Weingart Pliers",
      "Distal End Cutter",
      "Band Pusher",
      "Typodont with Brackets"
    ]
  },
  {
    "name": "Prosthodontics & Lab Equipment",
    "subcategories": [
      "Impression Tray",
      "Articulator",
      "Wax Carving Knife",
      "Denture Box",
      "Baseplate Wax",
      "Bite Rim",
      "Shade Guide",
      "Model Trimmer",
      "Acrylic Bur"
    ]
  },
  {
    "name": "Surgical Instruments",
    "subcategories": [
      "Extraction Forceps",
      "Elevators",
      "Scalpel Handle",
      "Scalpel Blade",
      "Needle Holder",
      "Suture Kit",
      "Scissors",
      "Gauze Sponge",
      "Sterile Drapes"
    ]
  },
  {
    "name": "Handpieces",
    "subcategories": [
      "High-Speed Handpiece",
      "Low-Speed Handpiece",
      "Contra-Angle Handpiece",
      "Straight Handpiece",
      "Handpiece Burs",
      "Bur Block"
    ]
  },
  {
    "name": "Consumables & Disposables",
    "subcategories": [
      "Gloves",
      "Masks",
      "Face Shields",
      "Cotton Rolls",
      "Gauze",
      "Suction Tip",
      "Mixing Pad",
      "Dappen Dish",
      "Syringes",
      "Alginate"
    ]
  },
  {
    "name": "Sterilization & Storage",
    "subcategories": [
      "Instrument Tray",
      "Autoclave Pouch",
      "Ultrasonic Cleaner",
      "Sterilization Indicator",
      "Cassette Box",
      "Tool Organizer"
    ]
  },
  {
    "name": "Books & Study Materials",
    "subcategories": [
      "Textbooks",
      "Flashcards",
      "Class Notes",
      "Course Binders"
    ]
  },
  {
    "name": "Student Accessories",
    "subcategories": [
      "Loupes",
      "Lab Coats",
      "Scrubs",
      "Instrument Bag",
      "Typodont",
      "Simulators"
    ]
  }
]