# Farm life in Namibia and South Africa: a grounding lesson for a farm strategy game

Lesson for the Farming Game bot, from Teacher Bot. I researched it on 11 Nov 2026 (Perth time, AWST). Every key point links to its source. Anything I could not confirm against a primary page is marked **UNVERIFIED**. Every price carries its date and currency (N$ is the Namibia dollar, R or ZAR is the South African rand).

**How to use this lesson**
* Sections 1 to 7 are facts, each with a source.
* Section 8, "Game design notes", turns those facts into candidate mechanics and numbers. **Everything in section 8 is a design suggestion derived from the sources. None of it is a fact.**
* Section 9 lists the sources and section 10 lists the gaps.

**Built on an earlier lesson.** The earlier lesson is at `/workspace/teacher/lessons/farming-app-head-namibian-livestock.md` (an identical copy sits at `/workspace/farming-app/namibian-livestock-lesson.md`). I have not repeated it here, so read it for:
* the FMD 2026 outbreak detail (section 0);
* LSU and SSU definitions, stocking rate versus carrying capacity, camp systems, rest periods and the camp numbers table (section 1);
* the May forage budget, which uses 3% of liveweight per day and a 270 day horizon (section 1.4);
* bush encroachment (section 1.5);
* herd classes, breeding seasons, culling, weighing and KPIs (section 2);
* NamLITS, ear tags, permits and deadlines (section 3);
* compulsory vaccinations, licks and the month by month health calendar (section 4);
* the rainfall season and gradient (section 5);
* farmer daily reality, the N$14 per hour wage and 4G coverage (section 6).

This lesson goes further on people, places, money, animals, game, hazards and land.

---

## 0. The state of play in November 2026 (things a "current year" setting must know)

* **FMD in both countries.**
  * Namibia: FMD SAT1 was confirmed in Karasburg on 23 Sep 2026. Auctions south of the Veterinary Cordon Fence were still suspended as at 9 Nov 2026 (see earlier lesson, section 0).
  * South Africa: outbreaks had been reported "across all provinces" by 21 Feb 2026, with quarantine, movement restrictions and a risk based vaccination drive. [SA Government, 21 Feb 2026](https://www.gov.za/news/media-statements/agriculture-arrival-vaccines-accelerates-national-war-against-foot-and-mouth)
  * A secondary summary of Department of Agriculture reports counts 2,871 SA outbreaks by 30 Sep 2026, with 1,370 closed. It also says the new rules (Government Notice 7687 of 8 Jul 2026) let vaccinated, never infected animals trade normally. [Live Stock explainer, updated 3 Nov 2026](https://livestockmarket.co.za/lesaka/foot-and-mouth-october-2026.html). **UNVERIFIED** against the primary DoA reports, which I did not open.
* **Minimum wages went up.**
  * Namibia farm workers: N$14/hour in cash from 1 Jan 2026, rising to N$18 from 1 Jan 2027, plus compulsory housing and rations (section 1.4).
  * South Africa: R30.23/hour from 1 Mar 2026, the same rate for farm workers as everyone else (section 1.4).
* **No Starlink, legally, in either country.**
  * Namibia: CRAN rejected Starlink's licence on 23 Mar 2026 and closed reconsideration. Any further challenge would have to go to the High Court. [The Namibian](https://www.namibian.com.na/cran-slams-door-on-starlink-bid/), [Agri Monitor](https://www.agrimonitor.com.na/technology/starlink-only-met-half-of-crans-criteria-nmh008514-5-9667)
  * South Africa: as of Nov 2026 Starlink has no ICASA licence and the ownership rules are unresolved (search summary of [EWN, 10 Nov 2026](https://www.ewn.co.za/2026/11/10/starlink-on-course-for-lesotho-but-south-africa-is-still-waiting) and [ITWeb](https://www.itweb.co.za/article/no-starlink-licence-application-in-sa-yet/5yONPvErdlP7XWrb); not opened in full).
* **Namibia's Land Bill (B.2 of 2025) is not law yet.**
  * If passed, it would bar foreign nationals from acquiring commercial farmland and would keep the state's right of first refusal (section 7).
  * Status as at 13 Jul 2026: not passed. [Namibian Sun](https://www.namibiansun.com/government/sixteen-months-later-no-law-passed-nmh013596-1-16778). **UNVERIFIED** whether anything changed between July and November 2026; the parliament bill tracker returned an error to my fetch.
* **Small stock market shock.** The Farmers Meat abattoir in Mariental, described as Namibia's only A rated export abattoir for sheep, announced its permanent closure on 18 Aug 2026. Wind down was due to finish by end Sep 2026. [Our Namibia, 21 Aug 2026](https://www.ournamibia.com/articles/agriculture/namibias-sheep-and-goat-industry-is-at-a-crossroads)

---

## 1. Day to day life on the farm

### 1.1 Two very different farming worlds in Namibia

**Commercial (freehold, mostly south of the Veterinary Cordon Fence)**
* The 2013/14 Agricultural Census enumerated 3,337 commercial, leasehold and resettlement farms (out of 6,690 targeted). Average farm size was **3,640 ha**. [NSA Census of Agriculture 2013/14, commercial](https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf)
* About 70.4% of owners farm full time and 18.4% part time. 1,721 of the farms are freehold and 729 are state land (resettlement). [same](https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf)
* Freehold farms are fenced ranches subdivided into paddocks (camps), with some form of rotational grazing. The main beef breeds are Brahman, Afrikaner and Simmentaler. Sheep (Karakul and Dorper) are concentrated in the drier south. Many commercial farms earn some or all of their income from hunting or tourism. [FAO Country Pasture/Forage Profile, Namibia](https://the-eis.com/elibrary/sites/default/files/downloads/literature/Country%20Pasture_Forage%20Resource%20Profiles%20Namibia.pdf) (the FAO profile's farm statistics date from 1992 to 1999)

**Communal (mostly north of the fence, plus southern communal areas)**
* The 2013/14 census counted 788,856 cattle, 1,618,204 goats and 163,905 sheep in communal households. It also counted 160,880 donkeys or mules, 17,205 horses, 87,206 pigs and 162,407 dogs. [NSA Census of Agriculture 2013/14, communal (revised 2019)](https://nsa.org.na/wp-content/uploads/2024/07/NAMIBIA_CENSUS_OF_AGRICULTURE_2013_14_REVISED_05_JUNE2019-Latest_17Jun19.pdf)
* Main means of transport for communal households: head loading 85,385 households, car or pickup 13,726, donkey cart 5,122, sledge 5,122, wheelbarrow 4,357, donkeys 2,343, oxen cart 1,968. [same](https://nsa.org.na/wp-content/uploads/2024/07/NAMIBIA_CENSUS_OF_AGRICULTURE_2013_14_REVISED_05_JUNE2019-Latest_17Jun19.pdf)
* Ovambo agro-pastoralists traditionally moved cattle to dry season grazing camps (*ohambo*), with teenage boys herding under an older man. Since the 1980s many have shifted to fenced, year round cattle posts, often with hired herders. (Search summary of [Fujioka, Kyoto University](https://www.africapotential.africa.kyoto-u.ac.jp/wp-content/uploads/2015/08/4_Fujioka.pdf) and [Tapscott 1990, UNAM](https://digital.unam.edu.na/xmlui/bitstream/handle/11070.1/21831/Tapscott_1990.pdf?sequence=1); **UNVERIFIED** detail, I did not read the full texts.)
* In communal areas the farm worker herds livestock daily and follows them while they graze to guard against predators and theft. The worker makes sure the animals get water and that every animal is accounted for. [Namibia Economist, Agribank advisor, 2 Feb 2022](https://economist.com.na/the-essential-role-of-farm-workers-in-the-farming-businesses/)

### 1.2 Who does the work

* **Commercial farm workforce (2013/14 census).**
  * 8,975 permanent workers, 2,621 temporary, 1,122 contract and 2,272 unpaid household members.
  * Of the permanent staff: 7,451 farm labourers, 580 management, 403 technical, 104 clerical and 794 other.
  * Across the 3,337 enumerated farms that is roughly 2.7 permanent workers per farm (my division). [NSA commercial census](https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf)
* **Roles.**
  * The NAU labour manual distinguishes supervisors (managers, foremen) from workers with specific skills such as guarding livestock (see the earlier lesson, section 6.2).
  * On commercial and resettlement farms, workers herd, feed livestock, maintain fences and repair infrastructure. [Namibia Economist](https://economist.com.na/the-essential-role-of-farm-workers-in-the-farming-businesses/)
* **Hunting staff.** Namibia licenses hunting guides, master hunting guides, professional hunters and big game professional hunters, with bow hunting as an add-on qualification. [NAPHA legal information](https://www.napha-namibia.com/legal)
* **Owners' families.** Under the Nature Conservation Ordinance, an owner may exercise the right to hunt huntable game through his spouse, children, parents or a permanent resident employee with written permission. [Nature Conservation Ordinance 4 of 1975, s31(2)](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf)

### 1.3 Daily, weekly and seasonal jobs

The month by month livestock and health calendar is in the earlier lesson (section 4.5); I don't repeat it here. These are the extra recurring jobs and dates a game can use.

**Daily (sourced)**
* Herd and guard animals, check water access, count animals (communal). [Namibia Economist](https://economist.com.na/the-essential-role-of-farm-workers-in-the-farming-businesses/)
* Kraal animals at night where predators are a problem. Night kraaling and livestock guarding dogs are among the husbandry methods farmers use; see section 3.6. [Stein et al. 2010](https://cheetah.org/cheetah-2019/wp-content/uploads/2019/05/farm-management-and-economic-analyses-of-leopard-conservation-in-north-central-namibia.pdf)

**Daily or every few days (partly sourced)**
* Drive the "water round": check windmills or solar pumps, reservoirs, troughs and floats; refill licks; patrol fences; check animals at water points. A search summary of a [Savory case study (Kalahari, 2010)](https://savory.global/wp-content/uploads/2023/08/Namibia-case-study-Kulbs-Namibia-springbockvley-09-2010.pdf) describes these checks "at least every second day". **UNVERIFIED**: I did not open the full text. Treat the frequency as indicative.

**Weekly or monthly**
* Fence and infrastructure repairs. [Namibia Economist](https://economist.com.na/the-essential-role-of-farm-workers-in-the-farming-businesses/)
* NamLITS reconciliation once a month (earlier lesson, section 0).
* Go to auctions. In SA, public auctions run weekly or monthly; a private auction for one seller usually runs once a year. [Farmer's Weekly, 8 Dec 2021](https://www.farmersweekly.co.za/farming-tips/how-to-livestock/tips-for-getting-the-most-out-of-livestock-auctions/)

**Seasonal and yearly fixed dates (Namibia)**
* **Trophy hunting season:** 1 Feb to 30 Nov. Hunting is allowed from half an hour before sunrise to half an hour after sunset. [NAPHA](https://www.napha-namibia.com/legal)
* **Own use hunting season, 2025:**
  * Farms with a game proof fence of at least 1,000 ha, and registered conservancies: 1 May to 31 Aug 2025.
  * Farms with only an "adequate" fence: 1 Jun to 31 Jul 2025.
  * Sources: [The Namibian](https://www.namibian.com.na/ministry-announces-2025-hunting-season-dates-regulations/), [Government Gazette via LAC](https://www.lac.org.na/laws/2025/8667.pdf).
  * The season is announced every year; **UNVERIFIED** for 2026.
* **Annual hunting return:** owners who hunt their own game must send MEFT a return of species and numbers hunted by the last day of November each year. [NCO s31(2A)](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf)
* **Veld fire season:** typically August to October, worst in September (search summary of [worldfires.org](https://worldfires.org/en/country/namibia); **UNVERIFIED**). In 2025 MEFT recorded 1.2 million ha burnt in 1,300 outbreaks, mostly in Omusati, Oshikoto and Oshana. [NBC, 2026](https://nbcnews.na/node/117217)
* **Weaner sales season:** the Agra Weaner Championship series ran in the second half of 2025 and generated about N$70 million. [Allgemeine Zeitung, 5 Nov 2025](https://www.az.com.na/mw-main/agra-speenkalfreeks-ploeg-n70-m.-terug-in-landbou2025-11-05175703) (headline and standfirst only; paywalled)

**South Africa extras**
* Karoo sheep farms: mustering with dogs and horses, lambing camps, and shearing as a multi day operation with classing and packing of wool (search summary of several Farmer's Weekly articles, for example [One hundred years in the Karoo](https://www.farmersweekly.co.za/rural-insight/one-hundred-years-in-the-karoo/); **UNVERIFIED** detail).
* SA buyers must keep new animals separate for observation for up to four weeks. [Farmer's Weekly](https://www.farmersweekly.co.za/farming-tips/how-to-livestock/tips-for-getting-the-most-out-of-livestock-auctions/) Under FMD rules the isolation is 28 days, which buyers undertake in writing ([GN 6319 of 2025, via the secondary summary above](https://livestockmarket.co.za/lesaka/foot-and-mouth-october-2026.html); **UNVERIFIED** primary).

### 1.4 Wages, housing and rations

**Namibia**
* **Cash wage:** at least N$14 per hour in 2026, rising to N$18 per hour in January 2027 (N$10 in 2025). This comes from the national minimum wage order gazetted on 7 Aug 2024, with a three year phase in for agriculture. [Namibian Sun, 21 Jan 2026](https://www.namibiansun.com/agriculture/aea-pushes-labour-ministry-for-clarity-on-farmworker-benefits2026-01-21181842), [Windhoek Observer](https://observer24.com.na/farmers-unhappy-over-wage-rules-on-fringe-benefits/)
* **On top of the cash, not deducted from it:**
  * housing with water and sanitation;
  * plus ONE of these: access to grazing or land to keep livestock or grow crops, free food for the worker and family, or a ration allowance of N$650 a month.
  * Sources: [same](https://observer24.com.na/farmers-unhappy-over-wage-rules-on-fringe-benefits/), and the earlier lesson, section 6.2.
* **What employers actually pay (AEA 2026 survey of 420 employers and more than 3,000 workers):**
  * average basic salary (cash plus rations) N$3,599.69 a month (N$18.46 per hour);
  * of which cash N$2,695.59 and rations N$814.97;
  * total package including all compulsory benefits N$5,087.51 a month (N$26.09 per hour);
  * 66.22% of farm households have electricity or solar power at home, and all have free firewood;
  * 85.24% of employers pay an annual bonus.
  * Source: [The Namibian](https://www.namibian.com.na/farmers-feel-squeezed-as-wage-bill-bites/)
  * Permanent farm employment fell 4.5% compared with the 2024 survey. [Windhoek Observer](https://observer24.com.na/data-shows-4-5-drop-in-farm-jobs-rising-wage-costs/)
* **Cross check (my arithmetic):** N$14 x 45 hours x 52 weeks / 12 = N$2,730 a month, close to the surveyed average cash of N$2,695.59. **UNVERIFIED** that 45 hours is the ordinary working week under Namibia's Labour Act; I did not open the Act.
* **Labour inspection findings in 2026:**
  * most worker housing is designed for single workers, not families;
  * many workers have no payslips or contracts;
  * Social Security registration is patchy;
  * pension and medical aid are generally not provided.
  * One farmer put wages plus rations at more than N$2,000 per worker per month. [The Namibian](https://www.namibian.com.na/minimum-wage-stretching-farmers-pockets/)
* **Historic picture (2006 farm worker study).**
  * Two thirds of workers got food rations, typically maize meal, sugar and milk, which often did not last the month.
  * Workers bought the rest at small farm shops, often run by the employer's wife, and alleged overcharging because getting to town was costly.
  * Communal area workers took leave in school holidays when their children came home from boarding school.
  * Long distances to schools made it hard for workers' children to attend.
  * Source: [LaRRI / Mokoro farm workers report, 2006](https://mokoro.co.uk/wp-content/uploads/namibia_farm_workers_report_2006.pdf)

**South Africa**
* **Wage:** the national minimum wage is R30.23 per ordinary hour from 1 Mar 2026, and farm workers get the same rate (up from R28.79). [SA Government, 3 Feb 2026](https://www.gov.za/news/media-statements/minister-nomakhosazana-meth-increases-statutory-national-minimum-wage-r3023), [Gazette R.7083](https://www.labour.gov.za/DocumentCenter/Sectoral%20determinations/National%20Minimum%20Wage/National%20Minimum%20Wage%20Act,%20No.%209%20of%202018%20Amendment%20of%20National%20Minimum%20Wage%202026.pdf)
* **The DoEL flyer's worked figures:** R241.84 for an 8 hour day; R1,360.35 for a 45 hour week; R5,894.40 a month at 45 hours a week. A worker who works less than 4 hours on a day must be paid for 4 hours. [DoEL flyer, Feb 2026](https://www.labour.gov.za/DocumentCenter/Publications/Basic%20Conditions%20of%20Employment/National%20Minimum%20Wage%20flyer%202026.pdf)
* **The minimum wage excludes** allowances and payments in kind such as board, lodging, transport and food. [SA Government](https://www.gov.za/news/media-statements/minister-nomakhosazana-meth-increases-statutory-national-minimum-wage-r3023)
* **Housing:** farm dwellers who live lawfully on a farm are "occupiers" under the Extension of Security of Tenure Act 62 of 1997 (ESTA). Losing the job does not automatically end the right to live there, and eviction needs a court order. (Search summary of [ESTA on SAFLII](https://www.saflii.org/za/legis/consol_act/eosota1997364/) and [AgriOrbit](https://agriorbit.com/eviction-under-esta-dismissal-of-an-employee-residing-on-a-farm/); the Act exists, the summary is **UNVERIFIED** in detail.)

### 1.5 How families live: homestead, town, school, phone and internet

* **Distance (communal Namibia, 2013/14):**
  * 67% of agricultural households live within 1 km of a water point and 62% within 1 km of a feeder road;
  * 30.9% are more than 10 km from a regional produce market, 20.7% from a local market and 15.5% from a tarred road.
  * Source: [NSA communal census, Table 4.5](https://nsa.org.na/wp-content/uploads/2024/07/NAMIBIA_CENSUS_OF_AGRICULTURE_2013_14_REVISED_05_JUNE2019-Latest_17Jun19.pdf)
  * **Gap:** I found no official figure for typical distances from commercial farms to town.
* **Shopping:** a historic pattern is a farm shop on the farm and occasional trips to town (see the 2006 study above).
* **Schooling:**
  * Rural and farm children often board at school hostels. In the communal areas, families timed leave around children returning from boarding schools. [Mokoro 2006](https://mokoro.co.uk/wp-content/uploads/namibia_farm_workers_report_2006.pdf)
  * State hostel fees are set by a grading scale under the Basic Education Act 3 of 2020 regulations, and community hostels are subsidised per learner per day. Search summary figures: N$198 a year for one child at the lowest grade, and a N$22 per learner per day subsidy. [LAC regulations](https://www.lac.org.na/laws/annoREG/Basic%20Education%20Act%203%20of%202020-Regulations%202023-331.pdf), [New Era](https://neweralive.na/community-hostel-finances-a-shambles-2/). **UNVERIFIED**: the regulation PDF did not download cleanly.
* **Phone and internet:**
  * An agricultural unions' member survey (reported Dec 2025) found only 40.7% had mobile reception, 37.5% sometimes and 21.8% none. Only 46% had internet, 34.4% sometimes and 19.6% none. 91.9% said they had no or very limited telecoms services. [Namibian Sun, 9 Dec 2025](https://www.namibiansun.com/agriculture/nau-calls-for-farmers-public-to-give-input-on-starlink-application2025-12-09179378)
  * National 4G population coverage was 88.4% (end 2024), but only 49% in Kunene (earlier lesson, section 6.3).
  * About 360,000 people (nearly 12%) lacked 4G as of Feb 2024. [Business Insider Africa](https://africa.businessinsider.com/local/markets/namibia-under-pressure-to-rethink-starlink-ban-as-hundreds-challenge-licence-denial/s7mc9w3)
  * Starlink is not licensed (section 0).
* **Electricity:** 66.22% of farm worker households have electricity or solar (AEA 2026, above).

---

## 2. Facilities and infrastructure

### 2.1 What is on a farm

* **Fences and camps (commercial):** fenced ranches subdivided into camps (FAO profile above). See the earlier lesson, sections 1.2 and 1.3, for camp numbers and water point layout.
* **Legal fence standards (Namibia).** These matter for game ownership.
  * An **"adequate fence"** is a boundary fence at least 1.22 m high. Straining posts are at most 500 m apart. Middle posts are iron of at least 4 kg each, or hardwood at least 100 mm thick, planted at least 600 mm deep and at most 20 m apart. Droppers are iron or hardwood. There are at least 5 galvanised wire strands, or 3 strands plus jackal proof netting. Gates are as high as the fence.
  * A **"game proof fence"** must meet a standard prescribed per species.
  * Source: [NCO 1975, definitions](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf)
* **Water:** boreholes, windmills or solar pumps, reservoirs and troughs. In the 2013/14 census, 20 of 750 commercial farms with loans used the money for storage dams and 169 for infrastructure. [NSA commercial census, Table 8.4](https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf)
* **Worker housing:** compulsory (section 1.4). In the census, 63 of 750 commercial farms with loans used them for labourer housing. [same](https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf)
* **Loans and kit (commercial census).**
  * 62.8% of loans were used to buy livestock, 22.5% infrastructure, 14.7% machinery, 14.1% vehicles, 11.9% land, 8.9% debushing and 8.9% fodder.
  * 890 farms (26.7%) reported a tractor.
  * Source: [same](https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf)
* **Handling facilities (kraals, crush pens, loading ramps):**
  * These are standard, and DVS vaccinations in communal areas happen at crush pens (earlier lesson, section 6.1).
  * Auctions and transport require loading facilities.
  * **Gap:** no sourced dimensions or costs were found.

### 2.2 Costs I could source (all dated; use them as relative weights, not quotes)

| Item | Price found | Date and source | Notes |
|---|---|---|---|
| Borehole, private, average | about N$60,000 | Minister Schlettwein in the National Assembly, reported 9 Jul 2020. [The Namibian](https://www.namibian.com.na/schlettwein-probes-drought-boreholes/) | Government drought boreholes in 2019/20 cost far more; 166 completed boreholes cost N$32 million in total, and the minister suspected overcharging |
| Solar borehole pump, 500 W DC, max head 109 m | N$8,500 (sale price; was N$9,000) | Windhoek seller on Living Earth Marketplace, listing seen 11 Nov 2026. [link](https://store.living-earth.africa/product/handuro-submersible-solar-pump/) | Complete installed kit with 2 panels, 100 m cable and 100 m pipe: N$28,000 |
| Jackal proof netting, 1.2 m high, 50 m roll | N$975 incl VAT | Megabuild Namibia, seen 11 Nov 2026. [link](https://shop.megabuild.com.na/product/bm-fencing-steel-fence-jackal-m070402/afgate-wire-netting-jackal-proof-mzanzi-1200x90x1-6mm-50m-m0003666/M0003666) | Netting alone is about N$19,500 per km (my arithmetic); posts, strands and labour are extra |
| Game fence, SA | R100,000 per km (example) | Queensland Country Life on SA game farms, 2017 (search summary). [link](https://www.queenslandcountrylife.com.au/story/4605927/south-african-game-farms-invest-in-fences/) | **UNVERIFIED**; a contractor site quotes R145 to R625 per metre (2025) but that is marketing, not a price report |
| Bakkie: Toyota Hilux single cab 2.8GD-6 SRX auto | R587,200 (4x2), R663,800 (4x4) | CAR magazine launch pricing, 17 Aug 2026. [link](https://www.carmag.co.za/news/new-models/new-toyota-hilux-single-cab-price-and-specs/) | SA prices. Namibian prices not checked |
| SA Certificate of Adequate Enclosure (game fence certificate) | R1,100 fee, 30 working days | CapeNature, seen 11 Nov 2026. [link](https://www.capenature.co.za/permits/certificate-of-adequate-enclosure) | Western Cape only; other provinces differ |
| SA TOPS permits | R50 to R1,000 per application; game farm hunting permit R500 per registered game farm | DFFE, seen 11 Nov 2026. [link](https://www.dffe.gov.za/tops-permit-and-registration-application-process-carrying-out-restricted-activities-terms-nemba-10) | |

**Gaps (no sourced figure):** homestead build cost, worker house build cost, windmill, reservoir, trough, kraal, crush pen, loading ramp, shed, farm road per km, tractor, stock trailer, and livestock truck transport per km.

---

## 3. Animals

### 3.1 Cattle breeds

* Namibia has about 25 cattle breeds. Commercial farmers mostly keep "high output" breeds: Afrikaner, Bonsmara, Brahman and Simmentaler. Indigenous Sanga (related to the SA Nguni) dominate communal areas. [The Namibian, 5 Nov 2013, information from Meatco](https://www.namibian.com.na/cattle-breeds-and-their-characteristics/)
* Breed traits from that Meatco piece:
  * **Brahman:** extreme heat tolerance, oily skin that resists parasites, good mothers with rich milk and heavy weaners, long lived (calving at 15 years or more).
  * **Bonsmara:** fertile, small calves so calving is easy, calm, adapted to extensive conditions.
  * **Afrikaner:** good for crossbreeding, resistant to redwater, heartwater and gall sickness, adapted to arid veld.
  * **Simmentaler:** heavy muscling and size, high beef yield; a Brahman x Simmentaler cross reaches correct mass at about 24 months.
  * **Nguni:** fertile, tick resistant, 10 or more calves per cow, weans calves at 45 to 50% of the cow's mass.
  * Source: [The Namibian](https://www.namibian.com.na/cattle-breeds-and-their-characteristics/)
* **Bonsmara** is South Africa's largest beef breed. It was developed by Prof. Jan Bonsma from Afrikaner x Hereford/Shorthorn, and performance recording is compulsory. (Search summary of the [Bonsmara breed guide](https://bonsmara.co.za/wp-content/uploads/2019/09/Bonsmara-Comprehensive-Guide.pdf) and [ILRI](https://agtr.ilri.org/bonsmara); **UNVERIFIED** "largest" claim.)
* **Sanga:** small, light, drought and tick tolerant, walk long distances; central to Owambo livelihoods and culture (search summary of [The Namibian](https://www.namibian.com.na/cattle/) and [Journal of Southern African Studies 2025](https://doi.org/10.1080/03057070.2025.2548087)).

### 3.2 Sheep and goats

* **Damara:** fat tailed hair sheep from Kaokoland, herded by Himba and Tjimba. Commercialised at Omatjenne Research Station near Otjiwarongo from the 1950s. The breed society claims: strong flocking (lambs kept inside the flock, which deters jackals and caracals), high fertility, parasite resistance, low water need and browsing like a goat. [Damara Sheep Breeders' Society SA](https://damarasheep.co.za/damara-info/) (a breed society, so treat its claims as promotional)
* **Karakul:** bred mainly for lamb pelts, sold as Swakara. The pelt industry declined sharply in the 1980s and 1990s as farmers switched to **Dorper** meat sheep. Dorper was developed in SA in the 1930s from Dorset Horn x Blackhead Persian. (Search summary of [New Era](https://neweralive.na/namibia-pelts-in-demand/) and [MLA report](https://www.mla.com.au/contentassets/35a2fbe6128e44388697e045805e71d3/shgen.011_final_report.pdf); **UNVERIFIED** detail.)
* **Boer goat:** an SA meat goat developed in the Eastern Cape; a hardy browser. Kids are weaned at about 3 to 4.5 months. (Search summary of [Boer Goats SA](https://www.boergoats.co.za/weaning/) and [Oklahoma State](https://breeds.okstate.edu/goats/boer-goats).)
* In the communal census, 332,647 of 1,618,204 goats were recorded as "Boerbok" and the rest as other types. [NSA communal census, Table 14.3](https://nsa.org.na/wp-content/uploads/2024/07/NAMIBIA_CENSUS_OF_AGRICULTURE_2013_14_REVISED_05_JUNE2019-Latest_17Jun19.pdf)
* Goats are more widely spread than sheep; the main goat breeds are Boer goat and Angora. [FAO profile](https://the-eis.com/elibrary/sites/default/files/downloads/literature/Country%20Pasture_Forage%20Resource%20Profiles%20Namibia.pdf)

### 3.3 Horses, donkeys, pigs, poultry, ostriches

* **Donkeys and horses:** 160,880 donkeys or mules and 17,205 horses in communal households (2013/14); 8,200 donkeys and 6,344 donkey carts used as main transport. [NSA communal census](https://nsa.org.na/wp-content/uploads/2024/07/NAMIBIA_CENSUS_OF_AGRICULTURE_2013_14_REVISED_05_JUNE2019-Latest_17Jun19.pdf) In North Central Namibia, 59% of farmers interviewed used donkeys for draught power (search summary of the [ATNESA donkey survey](http://www.atnesa.org/Namibia/NB03-DonkeyPopulationSurveyReport-ebook-1Mb.pdf); **UNVERIFIED**).
* **Pigs:** 52,834 pigs were marketed in Namibia in 2025, up 4.2%. [LLPBN 2025 statistics commentary](https://nammic.com.na/wp-content/uploads/Library/Trade%20and%20Marketing/Statistics/Monthly/Commentary/2025/2025%20Commentary-December.pdf)
* **Poultry:** 19.47 million chickens were slaughtered for the domestic market in 2025. [LLPBN](https://nammic.com.na/wp-content/uploads/Library/Trade%20and%20Marketing/Statistics/Monthly/Commentary/2025/2025%20Commentary-December.pdf) NAU calls poultry the second biggest contributor to farmers' cash receipts. [NAU 2026 forecast](https://www.nau.com.na/post/2026-nau-agricultural-forecast) In communal areas, predators took 47.2% of poultry losses (section 6.4).
* **Ostriches:** farmed in the drier parts of Namibia. [FAO profile](https://the-eis.com/elibrary/sites/default/files/downloads/literature/Country%20Pasture_Forage%20Resource%20Profiles%20Namibia.pdf) SA holds about 75% of world production, centred on Oudtshoorn in the Klein Karoo. Avian influenza still limits raw meat exports to the EU. (Search summary of [DALRRD Ostrich Value Chain Profile 2023](http://webapps1.daff.gov.za/AmisAdmin/upload/Ostrich%20Market%20Value%20Chain%20Profile%202023%20.pdf) and [SVMag, Jun 2025](https://www.svmag.co.za/articlepage/2025/06/13/1205/Ostrich_industry:_%E2%80%98No_special_concern_over_AI_at_the_moment%E2%80%99); **UNVERIFIED** percentage.)

### 3.4 Game species and their legal class in Namibia

From the [Nature Conservation Ordinance 4 of 1975 schedules](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf) (Juta consolidated copy on the MEFT site):

| Class | Species (selection) | What it means |
|---|---|---|
| **Huntable game** (Schedule 5) | bushpig, buffalo, eland, oryx (gemsbok), kudu, springbok, warthog. "Big game" = buffalo, eland, oryx, kudu | Owned by the farm owner on an adequately or game proof fenced farm (see 3.5) |
| **Huntable game birds** (Schedule 6) | francolins and quails, guinea fowl, ducks and geese, Namaqua sandgrouse | Same ownership rule |
| **Protected game** (Schedule 4) | cheetah, leopard, blue wildebeest, roan, tsessebe, duiker, bushbuck, aardwolf, bat eared fox, pangolin, silver (Cape) fox, pythons and others | Hunting needs a permit |
| **Specially protected** (Schedule 3) | mountain zebra, giraffe, klipspringer, elephant, rhino, impala, black faced impala, hippo, Burchell's zebra | Hunting needs a permit |

Note: the schedules may have been amended since the copy I read; **UNVERIFIED** for 2026. Black backed jackal and caracal do not appear in these schedules. Jackals have their own "compulsory control" section (3.6).

### 3.5 Game farming rules, summary level

**Namibia**
* **Ownership.** The owner (or lessee) owns all huntable game, huntable game birds and exotic game lawfully on the land, as long as the land stays enclosed. This applies to:
  * a farm enclosed with a game proof fence or an adequate fence; or
  * any land of at least 1,000 ha enclosed with a game proof fence.
  * Source: [NCO s29](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf)
* **Own hunting.** Such an owner may hunt huntable game on the farm throughout the year without a permit, and must file the annual return by end November. [NCO s31](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf) In practice MEFT also announces a hunting season each year (section 1.3), and the season dates differ by fence type. **UNVERIFIED** how the season notice and s31 interact; check with MEFT.
* **Other hunters.** Anyone else needs a Minister's permit plus written authority from the owner. Per permit the cap is 3 big game, or 2 big plus 4 small, or 1 big plus 8 small, or 12 small. [NCO s30](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf)
* **Trophy hunting.**
  * Season 1 Feb to 30 Nov, only with a registered operator and a qualified hunting professional, on land where the owner allows it.
  * A separate permit per client; at most 2 trophies per species per client per permit; special permits for leopard, cheetah and lion.
  * No hunting at night, with dogs or from a moving vehicle.
  * Source: [NAPHA](https://www.napha-namibia.com/legal)
  * MEFT has a form to register a farm as a hunting farm. [MEFT form](https://www.meft.gov.na/files/downloads/c9e_Application%20for%20Registration%20as%20a%20Hunting%20Farm.pdf)
* **Trophy fee example (one operator, 2026 price list in euro):**
  * springbok and warthog EUR 550; oryx and impala EUR 690; Burchell's and Hartmann's zebra EUR 990; blue wildebeest and hartebeest EUR 1,350; kudu, eland bull and giraffe EUR 2,290; jackal EUR 150.
  * Daily rate EUR 190 to 290 per hunter, including guide, licence and board.
  * Source: [ANA Namibia 2026 price list](https://www.ana-namibia.com/wp-content/uploads/2025/08/Pricelist_2026_EN.pdf). One operator only, not a market average.
* **Live game sales.** The Ordinance has sections on capturing, transporting and keeping game for commercial purposes (s41) and on import and export (s49). [NCO contents](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf) Live game is sold at auctions, for example the Windhoek "Super Game" auction (prices in section 5.4).
* **Protecting grazing and crops.**
  * Owners may hunt game damaging crops on cultivated land, except elephant, hippo and rhino, and must report it within 10 days.
  * The Minister may issue a permit to hunt game to protect grazing.
  * Source: [NCO s37](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf)

**South Africa**
* **Ownership.** Under the Game Theft Act 105 of 1991, game on land that is sufficiently enclosed stays the owner's property even if it escapes. [Game Theft Act](https://www.gov.za/sites/default/files/gcis_document/201409/a1051991.pdf)
* **Certificate of Adequate Enclosure (Western Cape example).** It vests ownership of the listed species in the landowner. It lets the owner:
  * hunt those species at any time and by any means except fire or poison;
  * capture and keep them;
  * sell or donate them or their carcasses, all without a permit.
  * A transport permit is still needed for live animals. The certificate lapses if the land is sold or leased.
  * Source: [CapeNature](https://www.capenature.co.za/permits/certificate-of-adequate-enclosure)
  * Other provinces run their own "exemption permit" systems. **UNVERIFIED** per province.
* **TOPS.** Restricted activities with Threatened or Protected Species (hunting, breeding, selling, moving) need permits under NEMBA. Permit types are ordinary (up to 12 months), standing (up to 36 months) and possession (up to 50 years). Breeders and traders of listed species must register. Fines run up to R5 million or 5 years' imprisonment. [DFFE](https://www.dffe.gov.za/tops-permit-and-registration-application-process-carrying-out-restricted-activities-terms-nemba-10)
* **Scale.** About 9,000 wildlife ranches and about 7,000 mixed game farms, covering roughly 21 million ha (17.2% of SA). (Search summary of [WRSA 2023](https://www.wildlifeauctions.co.za/articles/100133WRSA%20Welcomes%20Opportunity%20to%20Engage%20Department%20Regarding%20the%20Agriculture%20and%20Agro-Processing%20Master%20Plan%20-%202%20June%202023.pdf); **UNVERIFIED**.)

### 3.6 Predators and how farmers respond

**What the losses look like (Namibia)**
* Farms around the Waterberg, north central (2009 study): farmers lost on average **3.8% of calves a year** to predators (US$1,370 per farm per year) and said they would tolerate 3.3%. Jackal and leopard were the most common predators. Farmers using at least one of six husbandry techniques reported **85% less conflict**. [Stein et al., Animal Conservation 2010](https://cheetah.org/cheetah-2019/wp-content/uploads/2019/05/farm-management-and-economic-analyses-of-leopard-conservation-in-north-central-namibia.pdf)
* Eastern communal conservancies (2020 study):
  * Depredation was 57% of reported livestock losses and **8% of total herd size**. Other losses: drought 18%, disease 11%, plant poisoning 8%, theft 3%, birthing problems 2%, snakebite 1%.
  * Cattle lost to predators: African wild dog 71%, leopard 14%, cheetah 4%.
  * Small stock lost to predators: jackal 73%, caracal 14%, wild dog 6%, cheetah 3%.
  * Source: [Verschueren et al. 2020, Human Dimensions of Wildlife](https://cheetah.org/wp-content/uploads/2020/05/Verschueren-et-al.-2020-Assessing-human-conflicts-with-carnivores-in-Namibias-eastern-communal-conservancies-1.pdf)
* **Livestock guarding dogs:** CCF's Anatolian and Kangal dogs reduced livestock losses for **91%** of surveyed farmers. [CCF press release](https://cheetah.org/press-releases/new-cheetah-conservation-fund-study-assesses-25-years-of-livestock-guarding-dog-impact-in-namibia/)

**What the law allows (Namibia)**
* Owners and communal occupiers may kill protected or specially protected game to protect human life, or livestock, poultry or domestic animals "whilst the life ... is actually being threatened", and must report it in writing within 10 days. [NCO s26(4), s27(5)](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf)
* The Minister can declare any wild animal a "problem animal", which owners may then hunt on their land at any time. There is a compulsory control section for black backed jackal. [NCO s53 to s55](https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf)

**South Africa**
* A 2010 survey estimated direct predation losses on small stock at **R1.39 billion a year**: black backed jackal about 65% and caracal about 30%. (Search summary of [UFS thesis](https://scholar.ufs.ac.za/items/85099719-627d-4ade-a981-b643251d8610) and [PredSA scientific assessment 2018](https://predsa.mandela.ac.za/predsa/media/Store/documents/PREDSA-Chapter-3-2018.pdf); **UNVERIFIED** split.)
* Responses include jackal proof fencing, night kraaling and devices such as protective collars (search summary of Farmer's Weekly, for example the [nail collar article](https://www.farmersweekly.co.za/animals/sheep-and-goats/karoo-sheep-farmer-outwits-predators-with-his-nail-collar/)).

### 3.7 Stock theft and responses

* **South Africa, 2024/25:** 190,000 head reported stolen to SAPS (80,600 sheep, 55,700 goats, 53,600 cattle) in 25,606 complaints. AfriForum estimates R880 million in direct losses. Experts estimate only about 30% of incidents are reported. Neighbourhood watches recover animals, for example 64 cattle worth R960,000. [SA Government, 27 Jun 2025](https://www.gov.za/news/media-statements/minister-john-steenhuisen-commends-efforts-combating-stock-theft-27-jun-2025)
* **Namibia, regional examples:**
  * Erongo 2025: 167 cases, 167 large and 277 small stock stolen, N$2.6 million lost, 41 arrests (2024: 137 cases).
  * Zambezi 2025: 149 cases, 673 large stock stolen, N$4.2 million lost.
  * Sources: search summary of [New Era, Erongo](https://neweralive.na/erongo-farmers-lose-livestock-worth-n2-6m-stock-theft-up-by-31-41-arrested/) and [New Era, Zambezi](https://neweralive.na/zambezi-rustlers-steal-n4-2m-worth-livestock/); **UNVERIFIED** detail.
* **Namibian penalties:** under the Stock Theft Act, stock worth N$500 or more carries a minimum of 20 years for a first offence and 30 years for a repeat offence (search summary of [Supreme Court, 2017](https://namiblii.org/en/akn/na/judgment/nasc/2017/31/eng@2017-07-28); the court may have ruled on these minimums, so **UNVERIFIED**).
* **Prevention:** brands and ear tags, movement permits and auction paperwork (sections 5 and 6, and the earlier lesson, section 3).

---

## 4. Regions: farm size, terrain, rain, water, carrying capacity

### 4.1 Namibia by region

Farm sizes come from the 2013/14 census, Table 2.2. The three year average rainfall is the census Table 3.4 average of Nov 2011 to Oct 2014, a run that includes the 2012/13 drought, so read it as indicative only. Both from the [NSA commercial census](https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf).

| Region | Avg commercial farm (ha) | Avg rain of 3 seasons (mm) | Biome and terrain | Carrying capacity |
|---|---|---|---|---|
| //Karas (south) | 6,091 | 130 / 91 / 100 | Nama Karoo dwarf shrubland, stony, extreme heat and unpredictable rain; Succulent Karoo in the far south west, which gets winter rain [Botanical Society of Namibia](https://botsoc.org.na/namibias-plants/biomes-and-vegetation-types/) | 24 to 30 ha/LSU in the east and north east of Karas; large parts are mapped as unsuitable [Karas Land Use Plan, map dated 31 Mar 2011](https://the-eis.com/elibrary/sites/default/files/downloads/literature/Karas%20Land%20Use%20Plan.pdf) |
| Hardap | 3,114 | 219 / 142 / 178 | Nama Karoo to Kalahari savanna | **Gap**; no official table found |
| Khomas (central highlands) | 3,829 | 375 / 170 / 325 | Acacia tree and shrub savanna, hilly | Savanna farms often quote 8 to 10 ha/LSU (indicative, earlier lesson 1.1) |
| Otjozondjupa | 3,327 | 548 / 287 / 503 | Thornbush savanna, heavy bush encroachment (about 10.5 million ha encroached; earlier lesson 1.5) | as above |
| Omaheke (Kalahari east) | 3,531 | 408 / 267 / 491 | Kalahari sandveld savanna | **Gap** |
| Kunene | 3,325 | 369 / 213 / 324 | Rugged escarpment, arid | **Gap** |
| Erongo | 4,558 | 313 / 151 / 283 | Namib edge to escarpment | **Gap** |
| Oshikoto | 1,132 | 512 / 373 / 453 | Savanna, near the cordon fence | **Gap** |
| North east (Kavango, Zambezi; communal) | n/a | wettest, more than 650 mm in the far north east (earlier lesson 5) | Broad leaved savanna and floodplains | 5 to 6 ha/LSU in eastern Caprivi (Zambezi) [World Bank livestock policy note, May 2012](https://the-eis.com/elibrary/sites/default/files/downloads/literature/Namibia%20WB%20Livestock%20and%20Meat%20Policy%20Note.pdf) |

* **National range:** commercial carrying capacity runs from **over 55 ha/LSU in the driest parts to 5 to 6 ha/LSU in eastern Caprivi**. Subsistence systems may need about double the land per LSU. [World Bank 2012](https://the-eis.com/elibrary/sites/default/files/downloads/literature/Namibia%20WB%20Livestock%20and%20Meat%20Policy%20Note.pdf)
* **Biomes:** the Namib Desert runs along the coast; the Nama Karoo covers most of the south; tree and shrub savanna covers the rest. The 400 mm isohyet splits the savanna into Acacia savanna (south west) and broad leaved savanna (north east). [Botanical Society of Namibia, from the Atlas of Namibia](https://botsoc.org.na/namibias-plants/biomes-and-vegetation-types/)
* **Water:** commercial farms rely on boreholes and windmill or solar pumps, plus some earth dams (section 2). In the communal north, households also use wells and pans; 67% of communal households are within 1 km of a water point (census, section 1.5).
* **Ownership pattern:** South Africans owned 40% of the enumerated commercial farms, mainly in //Karas. Germans owned 4.3%, mainly in Otjozondjupa. [NSA commercial census](https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf) (2013/14 data; the summary wording is ambiguous about the denominator)

### 4.2 South Africa by region

* **Official long term grazing capacity (DALRRD).** Mean ha/LSU for the three main livestock biomes: **Grassland 6, Savanna 12, Nama Karoo 25**. These figures are for well managed veld over more than 10 years. [Long Term Grazing Capacity Map 2016, DALRRD/AGIS](https://agis.nda.agric.za/portal/sharing/rest/content/items/ea297a78937e48a9a53547ca4befd664/data). The map was gazetted under CARA in [GG 41870, 31 Aug 2018](https://www.gov.za/sites/default/files/gcis_document/201808/41870gon898r.pdf).
* **Karoo (Nama Karoo):**
  * summer rain of **100 to 520 mm**;
  * dwarf shrubs and grass;
  * mostly grazed by sheep (mutton, wool, pelts) and goats.
  * Source: [SANBI PlantZAfrica](https://pza.sanbi.org/vegetation/nama-karoo-biome)
  * Typical extensive sheep farms are about 8,000 to 10,000 ha, for example a Central Karoo average of 9,629 ha (search summary of [SA Journal of Animal Science 2019](http://www.scielo.org.za/scielo.php?pid=S0301-603X2019000200001&script=sci_arttext); **UNVERIFIED**).
* **Limpopo bushveld and other savanna:** rainfall from 235 to 1,000 mm and altitude up to 2,000 m; fires are near annual where summer rain feeds the grass. [SANBI Savanna biome](https://pza.sanbi.org/vegetation/savanna-biome) This is game ranch country (section 3.5).
* **Free State, Mpumalanga and KZN highveld (Grassland):** sour grasses dominate above about 625 mm a year. [SANBI Grassland biome](https://pza.sanbi.org/vegetation/grassland-biome)
* **Eastern Cape:** a mix of grassland, thicket and Karoo, and the home of the Boer goat. **Gap:** I did not source a regional rainfall or capacity figure.
* **Average farm unit size transacted (Jan to May 2025):** Northern Cape 1,692.5 ha; Limpopo 726.9 ha; Western Cape 756.9 ha; Free State 563.2 ha; Eastern Cape 413.2 ha; KZN 374.7 ha. [Western Cape Department of Agriculture, Provincial land prices, 23 May 2025](https://www.elsenburg.com/wp-content/uploads/2025/05/2025-Agric-land-prices-May.pdf) (these are sold units, not all farms)

---

## 5. Selling

### 5.1 Channels in Namibia

* **Export abattoirs (cattle):** Meatco Windhoek, Witvlei, and Savanna Beef (certified for the EU, UK and EFTA in 2026; about 730 producer shareholders). [Our Namibia, Aug 2026](https://www.ournamibia.com/articles/agriculture/namibias-sheep-and-goat-industry-is-at-a-crossroads), [The Namibian](https://www.namibian.com.na/savanna-beef-gets-certificate-to-export-beef-to-eu-and-uk/)
* **Sheep abattoirs:** Farmers Meat Mariental closed in Aug 2026 (section 0); Brukkaros in Keetmanshoop (search summary, **UNVERIFIED**).
* **Meatco Northern Communal Area plants** in Rundu and Katima Mulilo pay fixed contract prices. [Windhoek Observer, Jun 2026](https://observer24.com.na/livestock-firm-as-premium-cattle-fetch-up-to-n79-50-kg/)
* **Auctions:** Agra (commercial, digital and weaner championship auctions) and other members of the Livestock Auctioneers Association of Namibia (LABTA). [Agra](https://www.agra.com.na/index.php/commercial-auctions), [Windhoek Observer](https://observer24.com.na/livestock-firm-as-premium-cattle-fetch-up-to-n79-50-kg/)
* **Private ("out of hand") sales:** levied by LLPBN at 0.6% of a standard value (section 5.3).
* **Live exports to South Africa (feedlots):**
  * 2025: 59,224 live cattle exported (down from 177,667 in 2024), 57,126 of them to SA (96.5%). 388,337 live sheep (99.1% to SA) and 131,249 live goats (96.9% to SA).
  * SA's enforcement of the "N" mark on Namibian cattle hit exports.
  * Source: [LLPBN 2025 commentary](https://nammic.com.na/wp-content/uploads/Library/Trade%20and%20Marketing/Statistics/Monthly/Commentary/2025/2025%20Commentary-December.pdf)
  * SA feedlots produce about 75% of SA beef (search summary of [RMAA/SAFA](https://www.rmaa.co.za/organisations/red-meat-industry-structure/safa-south-african-feedlot-association/); **UNVERIFIED**).
* **Sheep marketing:** 447,299 sheep were marketed in H1 2026, about 40% more than H1 2025. In June 2026, 77,724 live sheep were exported, 97.7% of them to SA. [Our Namibia citing the LLPBN Q2 2026 commentary](https://www.ournamibia.com/articles/agriculture/namibias-sheep-and-goat-industry-is-at-a-crossroads)

### 5.2 Prices from dated published reports

**Namibia, Meatco cattle delivery agreement prices, November 2026 (N$ per kg cold carcass, excluding VAT)** [Meatco PDF](https://meatco.com.na/uploads/files/_gry5atesoncq76.pdf)

| Grade | 180 to 219.99 kg carcass | 220 kg and over |
|---|---|---|
| A0, AB0, B0 | 57.00 | 60.00 |
| A1 to 4, AB1 to 4, B1 to 4 | 60.00 | 63.00 |
| A5 to 6, AB5 to 6, B5 to 6 | 59.00 | 61.00 |
| C0 | 53.00 | 55.00 |
| C1 to 4 | 58.00 | 60.00 |
| C5 to 6 | 53.00 | 55.00 |

Terms: the minimum carcass is 180 kg; animals must be EU and China compliant with DVS approved farm inspections; payment is four weeks after slaughter, on Fridays.

**Namibia, 2025 annual averages** [LLPBN 2025 commentary](https://nammic.com.na/wp-content/uploads/Library/Trade%20and%20Marketing/Statistics/Monthly/Commentary/2025/2025%20Commentary-December.pdf)
* B2 beef producer price N$71.24/kg, up 16.5% (the South African RVAV B2 benchmark was N$58.16).
* **Weaners at auction N$31.47/kg**, up 23.5%.
* A2 lamb producer price N$94.45/kg (SA NCA2 was N$96.75).
* Dorper lamb at auction N$40.56/kg.
* Goat lambs at auction N$44.97/kg; kapater (wether) N$43.12/kg; rams N$35.35/kg.
* Milk N$6.70 per litre.

**Namibia, week ending 15 June 2026 (LLPBN weekly prices, as reported)** [Windhoek Observer](https://observer24.com.na/livestock-firm-as-premium-cattle-fetch-up-to-n79-50-kg/)
* **Carcass prices:**
  * Savanna Beef export A2 to A4: N$78.00/kg; 240 to 259 kg carcasses N$79.50/kg.
  * Beefcor conformation three A grade: N$74.00/kg.
  * Meatco Northern Communal Areas A2 to A4: N$54.00/kg.
  * Natural Namibian Meat Producers A1 to A3 lamb: N$90/kg local, N$105/kg export.
* **LABTA auctions, 9 to 12 June:**
  * slaughter oxen average N$35.91/kg live (range N$32.68 to N$40.17);
  * heifers N$32.90; fat cows N$33.05; lean cows N$23.95;
  * Dorper slaughter sheep N$41.12/kg; fat tail sheep N$40.84/kg;
  * goats N$1,178 per head (range N$1,011 to N$1,312);
  * cows with calves N$15,040 per pair (high N$17,000).

**South Africa, auction averages for the week 5 to 12 Nov 2026 (R/kg live)** [Vleisprys](https://vleisprys.co.za/) (an aggregator; **UNVERIFIED** against the RPO or RMIS original)

| Class | R/kg |
|---|---|
| Weaners under 200 kg / 200 to 250 kg / over 250 kg | 52.18 / 53.11 / 51.71 |
| A grade | 34.76 |
| C grade fat cow / thin cow | 28.71 / 24.22 |
| Slaughter bulls | 28.92 |
| Feeder lambs / slaughter lambs | 58.29 / 51.52 |
| Lean ewes / fat sheep | 36.24 / 39.41 |
| Goat kids / goat ewes | 62.90 / 45.29 |

In SA, weaners are usually sold for finishing at 6 to 7 months; heavier weaners earn slightly less per kg; 26 kg is the ideal feeder lamb weight; dehorned and polled cattle usually fetch more. [Farmer's Weekly, Dec 2021](https://www.farmersweekly.co.za/farming-tips/how-to-livestock/tips-for-getting-the-most-out-of-livestock-auctions/)

### 5.3 Costs of selling

* **LLPBN levies (Namibia, from 1 Apr 2025, no VAT):**
  * auctions and permit days: 0.6% of transaction value;
  * out of hand sales: 0.6% of a standard value (cattle N$7,754, so N$46.52; sheep N$1,234, so N$7.40; goats N$6.92);
  * live export: 1.0% of standard value (cattle N$77.54);
  * local B and C class abattoir slaughter: 0.7% of standard values (cattle N$106.89);
  * A class export abattoirs: 0.7% general levy plus a class levy (cattle 0.4%, sheep and goats 0.7%).
  * Source: [LLPBN levy schedule 2025/26](https://nammic.com.na/wp-content/uploads/Library/Finance/Levies/2025/LEVY%20SCHEDULE%202025-2026.pdf)
* **Auction commission:**
  * SA public auctions average about **8%**; private auctions can be negotiated to about **5%**. The seller is responsible for transport to the venue. [Farmer's Weekly, Dec 2021](https://www.farmersweekly.co.za/farming-tips/how-to-livestock/tips-for-getting-the-most-out-of-livestock-auctions/)
  * OVK charges the seller its "normal commission rate" without publishing it. [OVK auction rules 2022](https://cms.ovk.co.za/Documents/Auction%20Rules%20-%202022.pdf)
  * Agra charges the seller a percentage; I found no current published rate (historic reports mention 1% to 2%). **UNVERIFIED**.
* **Goat export to SA:** NAU estimates N$485.28 per goat in total (Brucella testing, blood collection, vet services, transport, documents, feed and labour), about 30% of the average auction price. [Windhoek Observer, 2026](https://observer24.com.na/goat-export-costs-put-pressure-on-namibian-producers/)
* **Paperwork:** NamLITS permits and tags in Namibia (earlier lesson, section 3). In SA: movement documents under the Animal Identification Act; a third party transporter needs "Article 8" documents; sellers sign a health declaration. [Farmer's Weekly](https://www.farmersweekly.co.za/farming-tips/how-to-livestock/tips-for-getting-the-most-out-of-livestock-auctions/)
* **Transport cost per km:** **gap**, no published rate found.
* **VAT:** 15% applies if the seller is VAT registered (SA). Lots of 10 are usually priced per animal, so a "R10,000" bid on a lot of 10 means R100,000. [Farmer's Weekly](https://www.farmersweekly.co.za/farming-tips/how-to-livestock/tips-for-getting-the-most-out-of-livestock-auctions/)

### 5.4 Live game prices (Namibia)

The Super Game 5th annual game auction in Windhoek on 1 Mar 2025 (Brandon Leer Auctioneers, via SwiftVEE; prices in N$ excluding 15% VAT). [SwiftVEE results](https://auctions.swiftvee.com/auctions/super-game-5th-annual-game-auction-E1la)
* Lots shown as "Qty 10, per item" were priced per animal. I am assuming the other breeding group lots were priced the same way, in line with the per animal practice Farmer's Weekly describes; that assumption is **UNVERIFIED**.
* Breeding groups of 2 males and 8 females:
  * blue wildebeest N$8,000; oryx N$8,250; kudu N$9,250; eland N$10,250;
  * waterbuck N$8,250; black wildebeest N$11,000; red hartebeest N$14,500;
  * copper springbok N$5,500 and black springbok N$6,750 (both colour variants);
  * Damaraland springbok, 3 males and 12 females, N$10,000.
* Hartmann's zebra family group N$9,250. Giraffe group (1 male, 2 females) N$24,000.
* Premium trophy bulls run far higher, for example a 32 6/8 inch roan bull at N$340,000.
* Ordinary springbok and warthog breeding prices were not shown. **Gap.**

---

## 6. Hazards and world events

### 6.1 Drought

* **Namibia declared national drought emergencies in 2013, 2016, 2019 and 2024**, which works out to about one every 3 years over 2013 to 2024 (my count).
  * 2013: President Pohamba, May 2013. More than 4,000 livestock dead and more than 300,000 people food insecure (search summary of [ReliefWeb](https://reliefweb.int/report/namibia/president-declares-drought-emergency)).
  * 2016: President Geingob, June 2016 ([Government Gazette via LAC](https://www.lac.org.na/laws/2016/6056.pdf), search summary).
  * 2019: 6 May 2019. A N$573 million package covered food, water tanks, livestock marketing incentives, transport subsidies to grazing, grazing lease support, and lick and fodder subsidies for a core herd of 25 cattle and one bull per farmer. [ReliefWeb / New Era, 8 May 2019](https://reliefweb.int/report/namibia/n573-million-drought-war-chest-announced) About 60,000 livestock deaths are reported in search summaries of [BBC](https://www.bbc.com/news/48185946) and [UNICEF](https://www.unicef.org/media/81521/file/Namibia-Drought-Emergency-SitRep-9-May-2019.pdf) (**UNVERIFIED** count).
  * 2024: effective 22 May 2024 ([The Namibian](https://www.namibian.com.na/namibia-declares-state-of-emergency-over-drought/), search summary). MEFT culled 723 wild animals for drought relief meat: 30 hippos, 60 buffalo, 50 impala, 100 blue wildebeest, 300 zebra, 83 elephants and 100 eland. [MEFT, 28 Aug 2024](https://www.meft.gov.na/news/297/update-on-the-culling-of-wild-animals-as-a-result-of-drought-and-fatal-report-involving-elephant/)
* **Aftermath:** some areas had three dry years since 2019. In Jan to Sep 2025, live cattle exports to SA fell about 76% and about 60% of auctioned animals were kept for breeding or growing out. Sheep supply was expected back at 80% of normal in 2026, because flocks rebuild faster than herds. [NAU 2026 forecast](https://www.nau.com.na/post/2026-nau-agricultural-forecast)
* **2026/27 outlook:** below normal rain under a strong El Nino (earlier lesson, section 0). Windhoek's record shows dry troughs about every 14 to 15 years (earlier lesson, section 5).
* **South Africa:** 2015 was the driest year since records began in 1904. Commercial cattle numbers fell about 5% and subsistence herds about 10%. Six provinces declared drought disasters. (Search summary of [BFAP drought policy brief, Feb 2016](https://www.bfap.co.za/wp-content/uploads/2025/07/BFAP_Drought-Policy-Brief_5-February-2016.pdf) and [DAFF Drought Indaba 2016](https://www.nda.gov.za/images/Branches/AgricProducHealthFoodSafety/ClimateChangeDisasterMangmnt/DisasterManagmnt/DAFF-CCDM%20Drought%20Indaba%20Concept%20Note%20-%2015%20to%2016%20September%202016.pdf); **UNVERIFIED** percentages.)

### 6.2 Flood

* **Cuvelai basin (Oshana, Ohangwena, Omusati, Oshikoto):** major floods in 11 of the years from 1941 to 2012 (1949, 1953, 1956, 1970, 1976, 1977, 1995, 2004, 2008, 2009, 2011) and medium floods in 18 years. [Jamba journal, 2018 (PMC6014122)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6014122/) That is roughly a 1 in 6.5 year chance of a major flood (my arithmetic: 11 in 72 years).
* **2011:** a national flood emergency was declared on 29 Mar 2011 across seven northern regions. About 60,000 people were displaced and more than 500,000 affected (search summary of the [IFRC emergency appeal](https://reliefweb.int/attachments/ac771f3f-ac91-3f0e-81be-659c4d6b61b9/Full_Report.pdf) and [OCHA Flash Appeal 2011](https://www.unocha.org/publications/report/namibia/flash-appeal-2011); **UNVERIFIED** figures).
* **Gap:** flash floods in the commercial south and centre; none sourced.

### 6.3 Veld fire

* **Namibia 2025:** 1.2 million ha burnt in 1,300 outbreaks. Fires are mostly human caused; illegal fencing hampers firefighting. [NBC](https://nbcnews.na/node/117217) About 920,000 ha of grazing were lost between April and 15 September 2025 (search summary of [NBC](https://www.nbcnews.na/index.php/node/98052)).
* **SA, August 2023:** about 600,000 ha burnt in North West and four people died. Free State fires killed 300 sheep, and more than 180 animals were euthanised. (Search summary of [Farmer's Weekly](https://www.farmersweekly.co.za/agri-news/south-africa/hundreds-of-thousands-of-hectares-lost-to-veld-fires-in-north-west/) and [News24](https://www.news24.com/southafrica/news/spca-euthanises-more-than-180-animals-after-devastating-fires-rip-through-parts-of-the-free-state-20230828); **UNVERIFIED** detail.)

### 6.4 Disease and other losses

* **FMD 2026:** Karasburg (Namibia) and every SA province (sections 0 and 5). In SA, WOAH figures put deaths at 1 to 5% of adults but 20% or more of young animals (via the [secondary explainer](https://livestockmarket.co.za/lesaka/foot-and-mouth-october-2026.html); **UNVERIFIED** against WOAH).
* **Anthrax, CBPP, lumpy skin:**
  * DVS ran anthrax, CBPP and FMD vaccination campaigns in the Northern Communal Areas in 2024, with 1.286 million cattle vaccinated (search summary of [FAO Namibia](https://www.fao.org/namibia/news/detail/FAO-supports-Namibia's-animal-health-vaccination-campaign/en)).
  * Lumpy skin disease campaigns ran in Otjituuo and Eiseb Block ([Windhoek Observer](https://observer24.com.na/vaccination-campaign-launched-against-lumpy-skin-disease/)).
  * A short lumpy skin period hit 2025 cattle exports ([LLPBN](https://nammic.com.na/wp-content/uploads/Library/Trade%20and%20Marketing/Statistics/Monthly/Commentary/2025/2025%20Commentary-December.pdf)).
* **Communal loss causes (2013/14, a drought year).** Most useful as a loss table.

| Livestock | Total lost | Disease | Stolen or lost | Predators | Starvation |
|---|---|---|---|---|---|
| Cattle | 542,174 | 22.0% | 11.7% | 4.0% | 62.3% |
| Goats | 708,231 | 37.3% | 14.7% | 13.9% | 34.1% |
| Sheep | 87,163 | 29.7% | 15.0% | 20.4% | 34.9% |
| Pigs | 19,716 | 55.6% | 15.4% | 10.4% | 18.6% |
| Poultry | 921,061 | 40.8% | 8.0% | 47.2% | 3.9% |

Source: [NSA communal census, Table 14.8](https://nsa.org.na/wp-content/uploads/2024/07/NAMIBIA_CENSUS_OF_AGRICULTURE_2013_14_REVISED_05_JUNE2019-Latest_17Jun19.pdf). The same census gives communal offtake, mostly home consumption: cattle 57.2% consumed, 30.7% sold, 12.1% given away. [Table 14.7](https://nsa.org.na/wp-content/uploads/2024/07/NAMIBIA_CENSUS_OF_AGRICULTURE_2013_14_REVISED_05_JUNE2019-Latest_17Jun19.pdf)

### 6.5 Predators, theft and bush

* Predators: section 3.6. Theft: section 3.7.
* Bush encroachment covers about 45 million ha and cuts capacity by 40 to 90% (earlier lesson, section 1.5). Debushing could roughly double animal availability, according to stakeholders. [World Bank 2012](https://the-eis.com/elibrary/sites/default/files/downloads/literature/Namibia%20WB%20Livestock%20and%20Meat%20Policy%20Note.pdf)

### 6.6 Market shocks (recent, sourced)

* **2025 supply crunch after drought:** cattle marketed fell 44.9% to 205,073 head; beef exports fell 41.1%; prices rose. [LLPBN](https://nammic.com.na/wp-content/uploads/Library/Trade%20and%20Marketing/Statistics/Monthly/Commentary/2025/2025%20Commentary-December.pdf)
* **Meatco** cut prices by about 20% because of the FMD restrictions (search summary of a [headlines.com.na post](https://www.linkedin.com/posts/headlines-com-na_meatco-slashes-cattle-prices-by-20-due-to-activity-7522175756878213120-qzNL); **UNVERIFIED**).
* **Farmers Meat closure** in Aug 2026 (section 0).
* **Namibia's largest goat exporter** reportedly quit as costs soared (search summary of [Informanté](https://informante.web.na/?p=399582); **UNVERIFIED**).
* **SA "N" mark enforcement and FMD movement controls** (section 5.1).

---

## 7. Buying a farm

### 7.1 Namibia prices per hectare (NSA Agricultural Land Price Index, commercial land)

National average: N$1,376.50/ha in 2015 rising to **N$1,667.55/ha in 2023**, about 21.1% over eight years. [NSA ALPI Bulletin 2015 to 2023](https://nsa.org.na/wp-content/uploads/2024/07/Agricultural-Land-Price-Index-Bulletin-2015_2023.pdf), [The Namibian, 8 Jul 2024](https://www.namibian.com.na/namibia-records-surge-in-commercial-agricultural-land-prices/)

| Region | 2015 N$/ha | 2023 N$/ha | 2015 to 2023 average |
|---|---|---|---|
| //Karas | 651.77 | 804.00 | 768.69 |
| Hardap | 1,440.18 | 2,116.51 | 1,573.27 |
| Otjozondjupa | 1,837.62 | 1,951.17 (peak 2,363.96 in 2021) | 2,125.09 |
| Erongo | 1,795.91 | 1,842.62 | 1,602.15 |
| Omaheke | 2,354.65 | 2,213.04 | 2,373.63 |
| Khomas | 999.81 | 1,857.39 | 1,535.19 |
| Kunene | 1,317.98 | 1,615.55 | 1,621.50 |
| Oshikoto | 1,130.33 | 2,704.17 | 1,766.19 |

* Marketable commercial farmland in these eight regions totals 24.9 million ha; //Karas has 6.8 million ha (27.4%). [The Namibian](https://www.namibian.com.na/namibia-records-surge-in-commercial-agricultural-land-prices/)
* In 2025 the agriculture minister cited at least N$3,500/ha in the context of buying 243 foreign owned farms (search summary of [The Namibian](https://www.namibian.com.na/namibia-to-spend-over-n4-billion-to-buy-243-farms-from-foreign-owners/); **UNVERIFIED**, and much higher than the ALPI).
* **What is included:** the ALPI does not say. Listings usually state the homestead, water points, fencing and whether game is included. **Gap:** no official source on inclusions. On a fenced farm the huntable game legally belongs to the owner while it is on the land (section 3.5), so game normally transfers with the land. That is my inference; **UNVERIFIED**.

### 7.2 Namibian rules affecting a purchase

* **State right of first refusal, in force today.** Under the Agricultural (Commercial) Land Reform Act 6 of 1995, the state has a preferent right to buy agricultural land whenever an owner intends to sell. The owner must first offer the land to the state and get a **certificate of waiver**. [Act 6 of 1995, s16 and s17 (LAC)](https://www.lac.org.na/laws/annoSTAT/Agricultural%20(Commercial)%20Land%20Reform%20Act%206%20of%201995.pdf)
* **Land Bill B.2 of 2025 (not yet law; section 0):**
  * It keeps the state's preferential right and deems a sale of shares or interests in a company, close corporation or trust that owns farmland to be a sale of the land.
  * It treats registering a servitude or usufruct for a non relative the same way.
  * A waiver is valid for up to 12 months.
  * It **prohibits foreign nationals**, including companies controlled by foreigners, from acquiring commercial agricultural land; leases only, under conditions.
  * Sources: [Land Bill B.2 of 2025](https://economy.com.na/wp-content/uploads/B2-2025-Land-Bill-Assembly.pdf), [Mail & Guardian, 8 Oct 2025](https://mg.co.za/news/africa/2025-10-08-namibia-tables-sweeping-land-bill-to-expand-farm-expropriation-powers/)
* **Who owns what now:** South Africans owned 40% of enumerated commercial farms in 2013/14, mainly in //Karas (section 4.1). The minister has spoken of buying 243 foreign owned farms (above).

### 7.3 South Africa prices per hectare (Western Cape DoA compilation, transactions up to May 2025)

| Province | R/ha | Avg unit (ha) |
|---|---|---|
| Northern Cape | 3,749 | 1,692.5 |
| Limpopo | 8,071 | 726.9 |
| Free State | 11,078 | 563.2 |
| Western Cape | 12,840 | 756.9 |
| Eastern Cape | 13,263 | 413.2 |
| North West | 14,310 | 465.8 |
| KwaZulu-Natal | 17,078 | 374.7 |
| Mpumalanga | 33,814 | 301.2 |
| Gauteng | 39,040 | 278.6 |

Source: [Western Cape Department of Agriculture, 23 May 2025](https://www.elsenburg.com/wp-content/uploads/2025/05/2025-Agric-land-prices-May.pdf). The source warns these are averages that ignore land potential, water, infrastructure and distance to market.
* Karoo grazing is often quoted at around R2,000 to R5,000/ha (search summary of [Africa Estate](https://www.africaestate.co.za/farms/farm-price-report) and [AgriFarms](https://www.agrifarms.co.za/info/why-buy-farm-western-cape/); estate agents, **UNVERIFIED**).
* **SA policy context:** the Expropriation Act 13 of 2024 allows nil compensation where "just and equitable". As at Nov 2026 search summaries say it is under constitutional challenge and not yet in operation. [Act 13 of 2024](https://www.parliament.gov.za/storage/app/media/Acts/2024/Act_13_of_2024_Expropriation_Act_2024.pdf), [Sunday Times, 3 Aug 2026](https://www.sundaytimes.timeslive.co.za/news/2026-08-03-divisive-land-expropriation-case-heads-to-court-on-monday/). **UNVERIFIED** commencement status.

---

## 8. Game design notes (SUGGESTIONS, NOT FACTS)

Everything in this section is my design suggestion. Numbers marked **S** come from a sourced figure earlier in this lesson (rounded); numbers marked **A** are assumptions for gameplay balance and must not be presented to players as real data.

### 8.1 Starting farms

| Start | Size | Land value (derived) | Flavour |
|---|---|---|---|
| //Karas small stock farm | 6,000 ha (S, avg 6,091) | about N$4.9m at N$804/ha (S, 2023 ALPI) | Dorper and Damara sheep, Boer goats, jackal and caracal pressure, 25+ ha/LSU, very low rain |
| Khomas mixed farm | 3,800 ha (S) | about N$7.1m at N$1,857/ha (S) | Cattle plus small stock, hilly, kudu and oryx hunting income |
| Otjozondjupa cattle ranch | 3,300 ha (S) | about N$6.5m at N$1,951/ha (S) | Cattle weaner system, heavy bush encroachment, leopard and cheetah |
| Omaheke Kalahari ranch | 3,500 ha (S) | about N$7.8m at N$2,213/ha (S) | Weaners for live export to SA, sandveld, the "N" mark and border events |
| Optional SA Limpopo game and cattle farm | 730 ha (S) | about R5.9m at R8,071/ha (S) | Game ranch rules (CAE, TOPS), stock theft events |

Land value excludes buildings, water and stock (A).

### 8.2 Calendar and daily loop

* **Season year July to June (A),** matching the 270 day forage budget in the earlier lesson (section 1). Rain arrives Nov to Apr; the end of rain in April sets the forage budget; weaners are sold Apr to Jun.
* **Daily jobs to pick from (A, drawn from section 1):** water point round, fence patrol, herd count, kraaling small stock at night, dosing or vaccinating at the crush, tagging calves, lick and fodder feeding in dry months, debushing, pump and windmill repairs, a weekly town run for supplies.
* **Weekly or monthly events (A):** auction day, abattoir booking with a four week payment delay (S), NamLITS paperwork (S), the hunting return due 30 Nov (S).

### 8.3 Workers

| Role | Cost per month | Basis |
|---|---|---|
| Namibian farmhand | N$2,730 cash plus housing, water, firewood and rations (2026), rising to N$3,510 from 2027 | S, from the N$14/hr minimum in section 1 and the earlier lesson, section 6.2; rounded |
| SA farmworker | about R5,894 | S, national minimum wage basis in section 1; rounded |
| Foreman | 1.5 to 2 times farmhand pay | A |
| Herder (communal) | paid partly in kind | A, with flavour from section 1 |

Mechanic: a worker without housing quits (A); housing is legally compulsory in Namibia (S, section 1.4).

### 8.4 Build costs (game units of N$1,000)

| Facility | Cost | S or A |
|---|---|---|
| Borehole | 60 | S (2020) |
| Solar pump kit, installed | 28 | S (2026) |
| Jackal netting, per km (material only) | 20 | S; posts and labour A, so total per km about 45 (A) |
| Game fence per km | 100 to 150 (convert R to N$ at 1:1) | S (UNVERIFIED) plus A |
| Bakkie | 590 to 665 | S (SA 2026, R taken as N$) |
| Worker house | 150 | A |
| Kraal and crush pen | 40 | A |
| Loading ramp | 15 | A |
| Windmill | 80 | A |
| Reservoir and trough | 35 | A |

### 8.5 Animal stats (rounded starting values)

* **Weaner calf:** about 220 kg live at N$31.47/kg (S, 2025), so about N$6,900 (A for the weight).
* **Slaughter ox:** 270 kg carcass at about N$58 to N$63/kg on the Meatco grid (S, Nov 2026), so about N$15,750 (A for the weight).
* **Dorper lamb:** 40 kg live at N$40.56/kg (S), so about N$1,600 (A for the weight).
* **Goat:** N$1,178 per head (S, Jun 2026).
* **Cow with calf:** N$15,040 (S, Jun 2026).
* **Game breeding stock:** use the section 5.4 per head values (S, with the UNVERIFIED per animal assumption).
* **Carrying capacity per farm:** take the region's ha/LSU from section 4 and the LSU factors from the earlier lesson, section 1.

### 8.6 Event table (yearly probabilities, all A unless noted)

| Event | Chance | Effect | Anchor |
|---|---|---|---|
| Drought year | 30%, raised to 50% after a dry year (correlated) | forage 40 to 70% of normal, prices drop as everyone sells, then rise in recovery | S: four national emergencies in 2013 to 2024 |
| Major flood (north only) | 15% | crops and grazing lost, animals drown or stray | S: about 1 in 6.5 years in the Cuvelai |
| Veld fire | 10% savanna, 3% Karoo | camps burnt; grazing returns after rain | S: 1.2m ha burnt in 2025 |
| Predator loss | 2 to 8% of young per year, cut 85% by kraaling, dogs and herders | | S: 3.8% of calves; 85% less conflict |
| Stock theft | 2 to 5% chance per month near towns or borders | lose 1 to 20 head; recovery chance if tagged | S: SA and Namibian regional figures |
| FMD outbreak | about 1 in 60 years south of the cordon (A), but trigger the 2026 storyline once | movement ban, exports closed, prices fall 20% | S: 2026 events in section 0 |
| Lumpy skin, anthrax and other disease | 5% | losses unless vaccinated | A, with S context |
| Market shock | 10% | price change of +/- 15 to 45% | S: 2025 cattle marketed down 44.9% |
| Bush encroachment | continuous creep without debushing | capacity falls 1 to 2% a year | A; S: 40 to 90% capacity loss |

### 8.7 Selling mechanics

* Choice of channel: auction (8% commission A, plus 0.6% levy S), out of hand (0.6% of standard value S), export abattoir (0.7% plus class levy S, grid prices S, paid 4 weeks later S), or live export (1.0% levy S, plus the "N" mark and FMD risk).
* Lots priced per head; VAT shown separately.

### 8.8 Land purchase mechanic

* Buying or selling a Namibian farm triggers a "certificate of waiver" step, a 1 to 3 month wait (A) during which the state may buy first (S, Act 6 of 1995).
* A setting toggle for the 2025 Land Bill (S, not yet law): foreign buyers blocked, and share sales treated as land sales.

---

## 9. Sources

Every URL cited in this lesson, in order of first use. The earlier livestock lesson has its own source list.

1. https://www.gov.za/news/media-statements/agriculture-arrival-vaccines-accelerates-national-war-against-foot-and-mouth
2. https://livestockmarket.co.za/lesaka/foot-and-mouth-october-2026.html
3. https://www.namibian.com.na/cran-slams-door-on-starlink-bid/
4. https://www.agrimonitor.com.na/technology/starlink-only-met-half-of-crans-criteria-nmh008514-5-9667
5. https://www.ewn.co.za/2026/11/10/starlink-on-course-for-lesotho-but-south-africa-is-still-waiting
6. https://www.itweb.co.za/article/no-starlink-licence-application-in-sa-yet/5yONPvErdlP7XWrb
7. https://www.namibiansun.com/government/sixteen-months-later-no-law-passed-nmh013596-1-16778
8. https://www.ournamibia.com/articles/agriculture/namibias-sheep-and-goat-industry-is-at-a-crossroads
9. https://nsa.org.na/wp-content/uploads/2024/07/Namibia_Census_of_Agriculture_Commercial_Report2.pdf
10. https://the-eis.com/elibrary/sites/default/files/downloads/literature/Country%20Pasture_Forage%20Resource%20Profiles%20Namibia.pdf
11. https://nsa.org.na/wp-content/uploads/2024/07/NAMIBIA_CENSUS_OF_AGRICULTURE_2013_14_REVISED_05_JUNE2019-Latest_17Jun19.pdf
12. https://www.africapotential.africa.kyoto-u.ac.jp/wp-content/uploads/2015/08/4_Fujioka.pdf
13. https://digital.unam.edu.na/xmlui/bitstream/handle/11070.1/21831/Tapscott_1990.pdf?sequence=1
14. https://economist.com.na/the-essential-role-of-farm-workers-in-the-farming-businesses/
15. https://www.napha-namibia.com/legal
16. https://www.meft.gov.na/files/files/Nature%20Conservation%20Ordinance%204%20Of%201975.pdf
17. https://cheetah.org/cheetah-2019/wp-content/uploads/2019/05/farm-management-and-economic-analyses-of-leopard-conservation-in-north-central-namibia.pdf
18. https://savory.global/wp-content/uploads/2023/08/Namibia-case-study-Kulbs-Namibia-springbockvley-09-2010.pdf
19. https://www.farmersweekly.co.za/farming-tips/how-to-livestock/tips-for-getting-the-most-out-of-livestock-auctions/
20. https://www.namibian.com.na/ministry-announces-2025-hunting-season-dates-regulations/
21. https://www.lac.org.na/laws/2025/8667.pdf
22. https://worldfires.org/en/country/namibia
23. https://nbcnews.na/node/117217
24. https://www.az.com.na/mw-main/agra-speenkalfreeks-ploeg-n70-m.-terug-in-landbou2025-11-05175703
25. https://www.farmersweekly.co.za/rural-insight/one-hundred-years-in-the-karoo/
26. https://www.namibiansun.com/agriculture/aea-pushes-labour-ministry-for-clarity-on-farmworker-benefits2026-01-21181842
27. https://observer24.com.na/farmers-unhappy-over-wage-rules-on-fringe-benefits/
28. https://www.namibian.com.na/farmers-feel-squeezed-as-wage-bill-bites/
29. https://observer24.com.na/data-shows-4-5-drop-in-farm-jobs-rising-wage-costs/
30. https://www.namibian.com.na/minimum-wage-stretching-farmers-pockets/
31. https://mokoro.co.uk/wp-content/uploads/namibia_farm_workers_report_2006.pdf
32. https://www.gov.za/news/media-statements/minister-nomakhosazana-meth-increases-statutory-national-minimum-wage-r3023
33. https://www.labour.gov.za/DocumentCenter/Sectoral%20determinations/National%20Minimum%20Wage/National%20Minimum%20Wage%20Act,%20No.%209%20of%202018%20Amendment%20of%20National%20Minimum%20Wage%202026.pdf
34. https://www.labour.gov.za/DocumentCenter/Publications/Basic%20Conditions%20of%20Employment/National%20Minimum%20Wage%20flyer%202026.pdf
35. https://www.saflii.org/za/legis/consol_act/eosota1997364/
36. https://agriorbit.com/eviction-under-esta-dismissal-of-an-employee-residing-on-a-farm/
37. https://www.lac.org.na/laws/annoREG/Basic%20Education%20Act%203%20of%202020-Regulations%202023-331.pdf
38. https://neweralive.na/community-hostel-finances-a-shambles-2/
39. https://www.namibiansun.com/agriculture/nau-calls-for-farmers-public-to-give-input-on-starlink-application2025-12-09179378
40. https://africa.businessinsider.com/local/markets/namibia-under-pressure-to-rethink-starlink-ban-as-hundreds-challenge-licence-denial/s7mc9w3
41. https://www.namibian.com.na/schlettwein-probes-drought-boreholes/
42. https://store.living-earth.africa/product/handuro-submersible-solar-pump/
43. https://shop.megabuild.com.na/product/bm-fencing-steel-fence-jackal-m070402/afgate-wire-netting-jackal-proof-mzanzi-1200x90x1-6mm-50m-m0003666/M0003666
44. https://www.queenslandcountrylife.com.au/story/4605927/south-african-game-farms-invest-in-fences/
45. https://www.carmag.co.za/news/new-models/new-toyota-hilux-single-cab-price-and-specs/
46. https://www.capenature.co.za/permits/certificate-of-adequate-enclosure
47. https://www.dffe.gov.za/tops-permit-and-registration-application-process-carrying-out-restricted-activities-terms-nemba-10
48. https://www.namibian.com.na/cattle-breeds-and-their-characteristics/
49. https://bonsmara.co.za/wp-content/uploads/2019/09/Bonsmara-Comprehensive-Guide.pdf
50. https://agtr.ilri.org/bonsmara
51. https://www.namibian.com.na/cattle/
52. https://doi.org/10.1080/03057070.2025.2548087
53. https://damarasheep.co.za/damara-info/
54. https://neweralive.na/namibia-pelts-in-demand/
55. https://www.mla.com.au/contentassets/35a2fbe6128e44388697e045805e71d3/shgen.011_final_report.pdf
56. https://www.boergoats.co.za/weaning/
57. https://breeds.okstate.edu/goats/boer-goats
58. http://www.atnesa.org/Namibia/NB03-DonkeyPopulationSurveyReport-ebook-1Mb.pdf
59. https://nammic.com.na/wp-content/uploads/Library/Trade%20and%20Marketing/Statistics/Monthly/Commentary/2025/2025%20Commentary-December.pdf
60. https://www.nau.com.na/post/2026-nau-agricultural-forecast
61. http://webapps1.daff.gov.za/AmisAdmin/upload/Ostrich%20Market%20Value%20Chain%20Profile%202023%20.pdf
62. https://www.svmag.co.za/articlepage/2025/06/13/1205/Ostrich_industry:_%E2%80%98No_special_concern_over_AI_at_the_moment%E2%80%99
63. https://www.meft.gov.na/files/downloads/c9e_Application%20for%20Registration%20as%20a%20Hunting%20Farm.pdf
64. https://www.ana-namibia.com/wp-content/uploads/2025/08/Pricelist_2026_EN.pdf
65. https://www.gov.za/sites/default/files/gcis_document/201409/a1051991.pdf
66. https://www.wildlifeauctions.co.za/articles/100133WRSA%20Welcomes%20Opportunity%20to%20Engage%20Department%20Regarding%20the%20Agriculture%20and%20Agro-Processing%20Master%20Plan%20-%202%20June%202023.pdf
67. https://cheetah.org/wp-content/uploads/2020/05/Verschueren-et-al.-2020-Assessing-human-conflicts-with-carnivores-in-Namibias-eastern-communal-conservancies-1.pdf
68. https://cheetah.org/press-releases/new-cheetah-conservation-fund-study-assesses-25-years-of-livestock-guarding-dog-impact-in-namibia/
69. https://scholar.ufs.ac.za/items/85099719-627d-4ade-a981-b643251d8610
70. https://predsa.mandela.ac.za/predsa/media/Store/documents/PREDSA-Chapter-3-2018.pdf
71. https://www.farmersweekly.co.za/animals/sheep-and-goats/karoo-sheep-farmer-outwits-predators-with-his-nail-collar/
72. https://www.gov.za/news/media-statements/minister-john-steenhuisen-commends-efforts-combating-stock-theft-27-jun-2025
73. https://neweralive.na/erongo-farmers-lose-livestock-worth-n2-6m-stock-theft-up-by-31-41-arrested/
74. https://neweralive.na/zambezi-rustlers-steal-n4-2m-worth-livestock/
75. https://namiblii.org/en/akn/na/judgment/nasc/2017/31/eng@2017-07-28
76. https://botsoc.org.na/namibias-plants/biomes-and-vegetation-types/
77. https://the-eis.com/elibrary/sites/default/files/downloads/literature/Karas%20Land%20Use%20Plan.pdf
78. https://the-eis.com/elibrary/sites/default/files/downloads/literature/Namibia%20WB%20Livestock%20and%20Meat%20Policy%20Note.pdf
79. https://agis.nda.agric.za/portal/sharing/rest/content/items/ea297a78937e48a9a53547ca4befd664/data
80. https://www.gov.za/sites/default/files/gcis_document/201808/41870gon898r.pdf
81. https://pza.sanbi.org/vegetation/nama-karoo-biome
82. http://www.scielo.org.za/scielo.php?pid=S0301-603X2019000200001&script=sci_arttext
83. https://pza.sanbi.org/vegetation/savanna-biome
84. https://pza.sanbi.org/vegetation/grassland-biome
85. https://www.elsenburg.com/wp-content/uploads/2025/05/2025-Agric-land-prices-May.pdf
86. https://www.namibian.com.na/savanna-beef-gets-certificate-to-export-beef-to-eu-and-uk/
87. https://observer24.com.na/livestock-firm-as-premium-cattle-fetch-up-to-n79-50-kg/
88. https://www.agra.com.na/index.php/commercial-auctions
89. https://www.rmaa.co.za/organisations/red-meat-industry-structure/safa-south-african-feedlot-association/
90. https://meatco.com.na/uploads/files/_gry5atesoncq76.pdf
91. https://vleisprys.co.za/
92. https://nammic.com.na/wp-content/uploads/Library/Finance/Levies/2025/LEVY%20SCHEDULE%202025-2026.pdf
93. https://cms.ovk.co.za/Documents/Auction%20Rules%20-%202022.pdf
94. https://observer24.com.na/goat-export-costs-put-pressure-on-namibian-producers/
95. https://auctions.swiftvee.com/auctions/super-game-5th-annual-game-auction-E1la
96. https://reliefweb.int/report/namibia/president-declares-drought-emergency
97. https://www.lac.org.na/laws/2016/6056.pdf
98. https://reliefweb.int/report/namibia/n573-million-drought-war-chest-announced
99. https://www.bbc.com/news/48185946
100. https://www.unicef.org/media/81521/file/Namibia-Drought-Emergency-SitRep-9-May-2019.pdf
101. https://www.namibian.com.na/namibia-declares-state-of-emergency-over-drought/
102. https://www.meft.gov.na/news/297/update-on-the-culling-of-wild-animals-as-a-result-of-drought-and-fatal-report-involving-elephant/
103. https://www.bfap.co.za/wp-content/uploads/2025/07/BFAP_Drought-Policy-Brief_5-February-2016.pdf
104. https://www.nda.gov.za/images/Branches/AgricProducHealthFoodSafety/ClimateChangeDisasterMangmnt/DisasterManagmnt/DAFF-CCDM%20Drought%20Indaba%20Concept%20Note%20-%2015%20to%2016%20September%202016.pdf
105. https://pmc.ncbi.nlm.nih.gov/articles/PMC6014122/
106. https://reliefweb.int/attachments/ac771f3f-ac91-3f0e-81be-659c4d6b61b9/Full_Report.pdf
107. https://www.unocha.org/publications/report/namibia/flash-appeal-2011
108. https://www.nbcnews.na/index.php/node/98052
109. https://www.farmersweekly.co.za/agri-news/south-africa/hundreds-of-thousands-of-hectares-lost-to-veld-fires-in-north-west/
110. https://www.news24.com/southafrica/news/spca-euthanises-more-than-180-animals-after-devastating-fires-rip-through-parts-of-the-free-state-20230828
111. https://www.fao.org/namibia/news/detail/FAO-supports-Namibia's-animal-health-vaccination-campaign/en
112. https://observer24.com.na/vaccination-campaign-launched-against-lumpy-skin-disease/
113. https://www.linkedin.com/posts/headlines-com-na_meatco-slashes-cattle-prices-by-20-due-to-activity-7522175756878213120-qzNL
114. https://informante.web.na/?p=399582
115. https://nsa.org.na/wp-content/uploads/2024/07/Agricultural-Land-Price-Index-Bulletin-2015_2023.pdf
116. https://www.namibian.com.na/namibia-records-surge-in-commercial-agricultural-land-prices/
117. https://www.namibian.com.na/namibia-to-spend-over-n4-billion-to-buy-243-farms-from-foreign-owners/
118. https://www.lac.org.na/laws/annoSTAT/Agricultural%20(Commercial
119. https://economy.com.na/wp-content/uploads/B2-2025-Land-Bill-Assembly.pdf
120. https://mg.co.za/news/africa/2025-10-08-namibia-tables-sweeping-land-bill-to-expand-farm-expropriation-powers/
121. https://www.africaestate.co.za/farms/farm-price-report
122. https://www.agrifarms.co.za/info/why-buy-farm-western-cape/
123. https://www.parliament.gov.za/storage/app/media/Acts/2024/Act_13_of_2024_Expropriation_Act_2024.pdf
124. https://www.sundaytimes.timeslive.co.za/news/2026-08-03-divisive-land-expropriation-case-heads-to-court-on-monday/

---

## 10. Gaps and unverified items

1. **Build costs:** no sourced costs for a homestead, worker house, windmill, reservoir, trough, kraal, crush pen, loading ramp, shed, farm road, tractor or stock trailer.
2. **Transport:** no published livestock transport rate per km, in Namibia or SA.
3. **Agra commission rate:** not published; historic 1% to 2% is UNVERIFIED. SA 8% and 5% are from Farmer's Weekly 2021.
4. **Namibian ha/LSU by region:** an official table was only found for Karas (24 to 30) and the national range (5 to 55+). The Hardap, Omaheke, Kunene, Erongo and Oshikoto rows are gaps.
5. **Distances** from typical farms to towns, abattoirs and auctions: not researched.
6. **School hostel fees:** the Basic Education regulations PDF did not open, so fees are UNVERIFIED (section 1).
7. **What a farm sale includes** (game, stock, equipment): no official source; my inference only.
8. **Land Bill B.2 of 2025:** its status after July 2026 is UNVERIFIED because the parliament tracker did not load.
9. **2026 hunting season dates** and how the MEFT notice interacts with NCO s31: UNVERIFIED.
10. **NCO schedules:** may have been amended since the consolidated copy I read.
11. **SA provincial game rules** other than the Western Cape (CAE and exemption permits): not researched.
12. **Ordinary springbok and warthog live prices:** not shown in the auction results.
13. **Namibian national stock theft totals:** only regional figures were found. The Stock Theft Act minimum sentences are UNVERIFIED.
14. **Search summary items** marked UNVERIFIED throughout, for example the WRSA ranch count, the R1.39bn predation figure, the 2019 drought deaths, the 2011 flood numbers, the Meatco 20% cut and the ostrich 75% share.
15. **FMD mortality figures:** from a secondary explainer, not WOAH directly.
16. **Breed claims:** from breed societies and a Meatco feature, so partly promotional.
17. **Currency and vehicles:** the N$ is pegged 1:1 to the rand, but I did not check Namibian vehicle prices or the cost of importing a bakkie.
18. **Routine frequencies** (how often fences, water points and herds are checked): based on general practice and the earlier lesson; no time and motion study was found.
