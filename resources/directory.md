Tucson Homeless Resources — Master Directory
For: tucsonway.org seed content
Compiled: June 2026
Sources: City of Tucson Housing & Community Development; ShelterListings.org (Tucson, AZ)

Build notes for the coding agent

This file is intended as the human-readable source of truth. A structured JSON/GeoJSON version can be derived from it.
Two tiers below: Verified Providers carry real street addresses and coordinates (from the City page — treat as authoritative). Additional Listings are ZIP-only (from ShelterListings) and require address verification + geocoding before display.
confidential_location: true entries (domestic-violence and some women's shelters) MUST NOT be plotted on a map or publish an address. Show "Call for location" and the hotline only.
Always confirm hours/availability by phone; data is provided as-is.



Quick-Access Tools (surface these first)
ToolWhat it doesLink / NumberLive Shelter Bed Dashboard (Pima County)Real-time shelter bed availabilitypimamaps.maps.arcgis.com/apps/dashboards/ca4fb93ec7014433b14e39a909873bd7Coordinated Entry / Housing Assessment (TPCH)System "front door" into housing servicestpch.net/coordinated-entry-for-homeless-services/General resource navigationStatewide info & referralDial 211EmergencyImmediate danger / medicalDial 911

Verified Providers (have address + coordinates)
Emergency Shelter
Salvation Army Hospitality House

Address: 1002 N. Main Ave., Tucson, AZ
Phone: (520) 795-9671
Type: Emergency shelter — open 24/7
Serves: Men, women (separate), 2 family apartments; respite, special needs, veterans
Notes: 100 beds, laundry, showers, 2 meals/day. Motel vouchers may be available for families with special needs.

Primavera Men's Shelter

Address: 200 E. Benson Highway, Tucson, AZ
Phone: (520) 623-4300
Type: Emergency shelter → long-term housing
Serves: Men
Notes: 7-night stays, extendable to 60 days if eligible. Call exactly at 9:00 a.m. to reserve a bed for that night; repeat daily until a bed opens.

Center of Opportunity (Gospel Rescue Mission)

Address: 4550 S. Palo Verde, Tucson, AZ
Phone: (520) 740-1501
Type: Emergency + recovery shelter
Serves: Men, women, and women with children
Notes: Case management, addiction recovery program, job-skills training, counseling. This campus also covers the Gospel Rescue Mission men's/women's emergency, extended, restoration, and women-and-children programs listed separately on third-party sites.

Family Shelter
Primavera Family Pathways Shelter

Address: 702 S. 6th Ave., Tucson, AZ
Phone: (520) 623-5111
Type: Family shelter (by appointment)
Serves: Families
Notes: Women with children needing immediate shelter are referred to Gospel Rescue Mission Women & Children's, (520) 740-1501.

Women
Sister José Women's Center

Address: 1050 S. Park Ave., Tucson, AZ
Phone: (520) 909-3905 · welcome@sisterjose.org
Type: Low-barrier day center + Winter Night Program (overnight)
Serves: Women

Primavera Casa Paloma Women's Shelter — confidential_location: true

Location: Undisclosed, near Speedway Blvd. & Main Ave.
Phone: (520) 623-5111
Type: Crisis shelter (short-term) + transitional housing (medium-term)
Serves: Women only
Notes: Do not map. Call for eligibility/appointment.

Domestic Violence
Emerge! Center Against Domestic Abuse — confidential_location: true

Location: Call for directions (not published)
Hotline (24-hr, multilingual): (520) 795-4266
Hotline (24-hr, toll-free): (888) 428-0101
Type: DV shelter + services
Notes: Do not map. Hotline is the gateway to all services; friends/family may call too.

Youth
Our Family Services — Youth

Address: 2590 N. Alvernon Way, Tucson, AZ
Phones: Youth 12–17 (520) 320-5122 · Young adults 18–24 (520) 323-1708 ext. 103 · Toll-free 1-800-537-8696
Email: intake@ourfamilyservices.org
Type: Youth housing & support
Notes: Safe Place — text "Safe" + your location to 44357; reply "2chat" to talk to a counselor.

Youth on Their Own

Address: 2525 N. Country Club Rd., Tucson, AZ
Phone: (520) 293-1136 · Toll-free (866) 496-8612
Type: Education support for homeless/unaccompanied students (grades 6–12, McKinney-Vento)
Notes: Application begins through a school liaison (principal/teacher/counselor).

Veterans
VA Hospital Homeless Program

Address: 3601 S. 6th Ave., Building 9, Tucson, AZ
Phone: (520) 792-1450 ext. 1839
Type: Veterans shelter
Notes: Requires DD-214 military record.

Employment / Self-Sufficiency
Sullivan Jackson Employment Center (Pima County)

Address: 400 E. 26th Street, Tucson, AZ
Phone: (520) 724-7300
Type: Employment & job-training center
Notes: Intake by appointment with a case manager.

City Program (outreach-based, no fixed public address)
City of Tucson Housing First Program

Type: Street outreach, emergency shelter, housing navigation, supportive housing
Link: tucsonaz.gov → Housing & Community Development → Homelessness → Housing First


Additional Listings (ZIP-only — VERIFY ADDRESS & GEOCODE before display)

These come from ShelterListings.org and lack full street addresses. Confirm address, status, and service details before publishing. Gospel Rescue Mission and Primavera duplicates already consolidated above are omitted here.

NameZIPPhoneType / ServesCasa Alitas Welcome Center85713(520) 330-6988Migrant shelterHedrick House (Halfway House)85719(520) 795-3334Recovery — men (alcohol)Greyhound Family Shelter85701(520) 882-538390-day emergency — familiesOld Pueblo Community Foundation (OPCS)85711(520) 546-0122Transitional; substance abuse; veteransCasa Santa Clara Transitional Housing85711(520) 546-0122Transitional — menPrimavera Foundation Rental Apartments85701(520) 867-6396Transitional / affordable rentalCatholic Community Services — Pio Decimo Center85701(520) 622-2801Transitional housingNew Life Community Resource Center85706(520) 889-8225HUD housing assistanceTMM Family Services85716(520) 322-9557Transitional housingMiracle Center85751(520) 327-1208Transitional housingTucson Urban League Housing Corp.85713(212) 558-5300Housing assistanceEsperanza En Escalante (Veterans)85730(520) 571-8294Veterans transitional / halfwayThe Giving Tree — Grace Home85711(520) 320-5437Youth (ages 0–18)

Data Model Suggestions (for the JSON/GeoJSON derivation)
Recommended fields per resource:

name
category — emergency | transitional | domestic_violence | youth | veterans | women | family | employment | outreach
address (nullable)
confidential_location (boolean)
lat, lng (nullable; null when confidential)
phone (array — supports multiple/after-hours lines)
hotline_24h (boolean)
email (nullable)
eligibility_notes
hours_notes
verified (boolean — true only for the City-sourced spine)
source_url

