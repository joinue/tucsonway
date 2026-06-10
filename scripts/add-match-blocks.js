#!/usr/bin/env node
/*
 * One-time script: add a compact `match` block to each resource in
 * data/resources.json. Run from project root: `node scripts/add-match-blocks.js`
 *
 * The `match` schema (all fields optional, sensible defaults assumed):
 *   g:                "men" | "women" | "any"               // gender restriction
 *   ages:             [minAge, maxAge]                       // age window served
 *   kids:             "ok" | "required" | "no"               // children policy
 *   vet:              true                                   // must be veteran
 *   lgbtq_focused:    true                                   // primarily LGBTQ
 *   pets:             true                                   // pets allowed
 *   sober:            true                                   // sobriety required
 *   faith:            true                                   // faith-based programming
 *   housing:          ["unhoused" | "at_risk" | "any"]       // current housing status
 *   needs:            ["shelter","food","showers","rent_assistance",
 *                      "mental_health","substance_use","dv","health",
 *                      "id_mail","employment","transportation","benefits","outreach"]
 *   tribal_only:      true
 *   post_incarceration: true
 *   crisis:           true
 *   intake:           "walk_in" | "call" | "appointment" | "referral" | "online" | "mixed"
 */
'use strict';
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'resources.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const M = {
  salvation_army_hospitality_house: {
    g: 'any', kids: 'ok', faith: true,
    needs: ['shelter', 'food', 'showers'],
    housing: ['unhoused'], intake: 'walk_in',
  },
  primavera_mens_shelter: {
    g: 'men', ages: [18, 999], sober: true,
    needs: ['shelter', 'food', 'showers', 'employment', 'mental_health', 'substance_use'],
    housing: ['unhoused'], intake: 'call',
  },
  gospel_rescue_mission_coo: {
    g: 'any', kids: 'ok', faith: true,
    needs: ['shelter', 'food', 'substance_use', 'employment'],
    housing: ['unhoused'], intake: 'walk_in',
  },
  gospel_rescue_mission_28th: {
    g: 'men', ages: [18, 999], faith: true,
    needs: ['shelter', 'employment', 'substance_use'],
    housing: ['unhoused'], intake: 'walk_in',
  },
  gospel_rescue_mission_miracle_mile: {
    g: 'women', kids: 'ok', faith: true,
    needs: ['shelter', 'substance_use', 'employment'],
    housing: ['unhoused'], intake: 'appointment',
  },
  primavera_family_pathways: {
    kids: 'required',
    needs: ['shelter'],
    housing: ['unhoused'], intake: 'mixed',
  },
  primavera_hip_drop_in: {
    needs: ['shelter', 'food', 'showers', 'id_mail', 'health'],
    housing: ['unhoused'], intake: 'walk_in',
  },
  sister_jose: {
    g: 'women', pets: true,
    needs: ['shelter', 'food', 'showers', 'mental_health'],
    housing: ['unhoused'], intake: 'walk_in',
  },
  primavera_casa_paloma: {
    g: 'women',
    needs: ['shelter', 'food', 'showers', 'health', 'mental_health'],
    housing: ['unhoused'], intake: 'mixed',
  },
  emerge: {
    kids: 'ok',
    needs: ['dv', 'shelter'],
    housing: ['unhoused', 'at_risk', 'any'], intake: 'call', crisis: true,
  },
  saaf_anti_violence: {
    lgbtq_focused: true,
    needs: ['dv', 'shelter', 'mental_health'],
    housing: ['unhoused', 'at_risk', 'any'], intake: 'call', crisis: true,
  },
  our_family_services_youth: {
    ages: [12, 24],
    needs: ['shelter', 'mental_health', 'employment', 'health', 'benefits', 'id_mail'],
    housing: ['unhoused', 'at_risk'], intake: 'call',
  },
  our_family_services_prevention: {
    ages: [18, 999],
    needs: ['rent_assistance'],
    housing: ['at_risk'], intake: 'call',
  },
  youth_on_their_own: {
    ages: [12, 21],
    needs: ['employment', 'food', 'benefits'],
    housing: ['unhoused', 'at_risk'], intake: 'referral',
  },
  va_homeless_program: {
    vet: true,
    needs: ['shelter', 'mental_health', 'substance_use', 'health', 'showers'],
    housing: ['unhoused', 'at_risk'], intake: 'walk_in',
  },
  primavera_project_action_veterans: {
    vet: true, post_incarceration: true,
    needs: ['rent_assistance', 'shelter', 'mental_health'],
    housing: ['at_risk', 'unhoused'], intake: 'call',
  },
  sullivan_jackson: {
    ages: [18, 999],
    needs: ['employment'],
    housing: ['unhoused'], intake: 'referral',
  },
  city_housing_first: {
    needs: ['shelter', 'outreach', 'showers'],
    housing: ['unhoused'], intake: 'call',
  },
  opcs_low_barrier_bridge: {
    kids: 'ok', post_incarceration: true,
    needs: ['shelter', 'mental_health', 'substance_use', 'employment'],
    housing: ['unhoused'], intake: 'call',
  },
  community_bridges_mens_shelter: {
    g: 'men', ages: [18, 999],
    needs: ['shelter'],
    housing: ['unhoused'], intake: 'call',
  },
  tucson_homeless_work_program: {
    needs: ['employment'],
    housing: ['unhoused'], intake: 'call',
  },
  interfaith_community_services: {
    needs: ['shelter', 'food', 'employment', 'rent_assistance', 'id_mail', 'transportation'],
    housing: ['unhoused', 'at_risk'], intake: 'call',
  },
  la_frontera_rapp: {
    needs: ['shelter', 'showers', 'mental_health', 'substance_use', 'id_mail'],
    housing: ['unhoused'], intake: 'walk_in',
  },
  pcoa_prevention: {
    ages: [60, 999],
    needs: ['rent_assistance'],
    housing: ['at_risk'], intake: 'call',
  },
  az_pet_project_adoh: {
    pets: true,
    needs: ['rent_assistance'],
    housing: ['at_risk', 'unhoused'], intake: 'online',
  },
  crisis_response_center: {
    needs: ['mental_health', 'substance_use'],
    housing: ['any'], intake: 'walk_in', crisis: true,
  },
  pima_county_crisis_line: {
    needs: ['mental_health'],
    housing: ['any'], intake: 'call', crisis: true,
  },
  codac: {
    needs: ['mental_health', 'substance_use'],
    housing: ['any'], intake: 'call',
  },
  la_frontera_center: {
    needs: ['mental_health', 'substance_use'],
    housing: ['any'], intake: 'call',
  },
  community_food_bank: {
    needs: ['food'],
    housing: ['any'], intake: 'walk_in',
  },
  casa_maria: {
    needs: ['food'],
    housing: ['any'], intake: 'walk_in',
  },
  caridad: {
    needs: ['food', 'employment'],
    housing: ['any'], intake: 'walk_in',
  },
  el_rio_homeless_clinic: {
    needs: ['health'],
    housing: ['unhoused', 'at_risk'], intake: 'call',
  },
  z_mansion: {
    needs: ['food', 'health'],
    housing: ['any'], intake: 'walk_in',
  },
};

let missing = [];
data.resources.forEach((r) => {
  if (M[r.id]) {
    r.match = M[r.id];
  } else {
    missing.push(r.id);
  }
});

if (missing.length) {
  console.warn('Resources missing match blocks:', missing.join(', '));
  process.exit(1);
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('Added match blocks to', data.resources.length, 'resources.');
