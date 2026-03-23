import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// VÚC IČOs from vuc_stats_14.json
const VUC_ICOS: Record<string, string> = {
  '36126624': 'Trenčiansky samosprávny kraj',
  '37870475': 'Prešovský samosprávny kraj',
  '37828100': 'Banskobystrický samosprávny kraj',
  '37808427': 'Žilinský samosprávny kraj',
  '37861298': 'Nitriansky samosprávny kraj',
  '35541016': 'Košický samosprávny kraj',
  '37836901': 'Trnavský samosprávny kraj',
  '36063606': 'Bratislavský samosprávny kraj',
}

const VUC_REGION_MAP: Record<string, string> = {
  'Trenčiansky samosprávny kraj': 'Trenčiansky kraj',
  'Prešovský samosprávny kraj': 'Prešovský kraj',
  'Banskobystrický samosprávny kraj': 'Banskobystrický kraj',
  'Žilinský samosprávny kraj': 'Žilinský kraj',
  'Nitriansky samosprávny kraj': 'Nitriansky kraj',
  'Košický samosprávny kraj': 'Košický kraj',
  'Trnavský samosprávny kraj': 'Trnavský kraj',
  'Bratislavský samosprávny kraj': 'Bratislavský kraj',
}

// Known cities in Slovakia (141 miest) — IČOs of the largest ones
// We'll use population > 5000 as a heuristic, plus known Bratislava/Košice
const BRATISLAVA_ICO = '00603481'
const KOSICE_ICO = '00691135'

async function main() {
  console.log('Seeding organizations...')

  // Load municipality data
  const dataPath = join(__dirname, '..', '..', 'data', 'municipalities_ico.json')
  const municipalities: Record<
    string,
    {
      ico: string
      official_name: string
      region: string
      district: string
      population: number
      type: string
      nuts5_code?: string
      gps_lat?: number
      gps_lng?: number
    }
  > = JSON.parse(readFileSync(dataPath, 'utf-8'))

  // Step 1: Insert VÚC records
  console.log('Inserting 8 VÚC records...')
  const vucRecords = Object.entries(VUC_ICOS).map(([ico, name]) => ({
    name,
    country: 'SK',
    entity_type: 'vuc',
    reg_id: ico,
    region: VUC_REGION_MAP[name] || null,
    claimed: false,
  }))

  const { data: vucData, error: vucError } = await supabase
    .from('organizations')
    .upsert(vucRecords, { onConflict: 'reg_id', ignoreDuplicates: true })
    .select('id, reg_id, region')

  if (vucError) {
    console.error('VÚC insert error:', vucError)
    // Try one-by-one
    for (const rec of vucRecords) {
      const { error } = await supabase.from('organizations').insert(rec)
      if (error && !error.message.includes('duplicate')) {
        console.error(`  Failed: ${rec.name}:`, error.message)
      }
    }
  }

  // Build region → VÚC id map
  const { data: allVucs } = await supabase
    .from('organizations')
    .select('id, region')
    .eq('entity_type', 'vuc')
  const regionToVucId: Record<string, string> = {}
  for (const v of allVucs || []) {
    if (v.region) regionToVucId[v.region] = v.id
  }
  console.log('VÚC region map:', Object.keys(regionToVucId).length, 'regions')

  // Step 2: Insert municipalities in batches
  const entries = Object.entries(municipalities)
  console.log(`Inserting ${entries.length} municipalities...`)

  const BATCH_SIZE = 500
  let inserted = 0

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const records = batch.map(([ico, m]) => {
      // Determine entity_type
      let entity_type = 'obec'
      if (ico === BRATISLAVA_ICO || ico === KOSICE_ICO) {
        entity_type = 'mesto'
      } else if (m.type === 'mesto') {
        entity_type = 'mesto'
      } else if (m.population >= 5000) {
        entity_type = 'mesto'
      }

      return {
        name: m.official_name,
        country: 'SK',
        entity_type,
        reg_id: ico,
        population: m.population || null,
        gps_lat: m.gps_lat || null,
        gps_lng: m.gps_lng || null,
        region: m.region || null,
        district: m.district || null,
        parent_id: regionToVucId[m.region] || null,
        metadata: m.nuts5_code ? { nuts5_code: m.nuts5_code } : {},
        claimed: false,
      }
    })

    const { error } = await supabase.from('organizations').insert(records)
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message)
      // Fall back to one-by-one for this batch
      for (const rec of records) {
        const { error: singleErr } = await supabase
          .from('organizations')
          .insert(rec)
        if (singleErr && !singleErr.message.includes('duplicate')) {
          console.error(`  Failed: ${rec.name}:`, singleErr.message)
        } else {
          inserted++
        }
      }
    } else {
      inserted += batch.length
    }
    console.log(`  ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`)
  }

  console.log(`Done! Inserted ${inserted} municipalities.`)

  // Verify
  const { count } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })
  console.log(`Total organizations in DB: ${count}`)
}

main().catch(console.error)
