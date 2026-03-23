import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function generateCode(orgName: string): string {
  const short = removeDiacritics(orgName)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 12)
  const year = new Date().getFullYear()
  const random = randomBytes(2).toString('hex').toUpperCase().slice(0, 4)
  return `${short}-${year}-${random}`
}

async function main() {
  const args = process.argv.slice(2)
  const icoIdx = args.indexOf('--ico')
  const maxUsesIdx = args.indexOf('--max-uses')

  if (icoIdx === -1 || !args[icoIdx + 1]) {
    console.error('Usage: npx tsx scripts/generate_invitation.ts --ico 00318744 [--max-uses 5]')
    process.exit(1)
  }

  const ico = args[icoIdx + 1]
  const maxUses = maxUsesIdx !== -1 ? parseInt(args[maxUsesIdx + 1]) || 1 : 1

  // Find organization
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, reg_id, region, entity_type')
    .eq('reg_id', ico)
    .single()

  if (error || !org) {
    console.error(`Organization with IČO ${ico} not found.`)
    process.exit(1)
  }

  const code = generateCode(org.name)

  // Insert invitation
  const { data: invitation, error: invError } = await supabase
    .from('invitations')
    .insert({
      org_id: org.id,
      code,
      created_by: 'system',
      max_uses: maxUses,
    })
    .select()
    .single()

  if (invError) {
    console.error('Failed to create invitation:', invError.message)
    process.exit(1)
  }

  console.log(`\nInvitation created for: ${org.name}`)
  console.log(`  IČO: ${org.reg_id}`)
  console.log(`  Region: ${org.region}`)
  console.log(`  Type: ${org.entity_type}`)
  console.log(`  Max uses: ${maxUses}`)
  console.log(`\n  Code: ${code}\n`)
}

main().catch(console.error)
