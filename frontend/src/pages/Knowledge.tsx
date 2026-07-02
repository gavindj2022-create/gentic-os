import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { api } from '../lib/api'
import type { KnowledgeTopic } from '../lib/types'
import AgentFace from '../components/AgentFace'
import { Search, BookOpen, ChevronDown } from 'lucide-react'

const glass = {
  background: 'rgba(13,13,13,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

export default function Knowledge() {
  const [topics, setTopics] = useState<KnowledgeTopic[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [vaultStats, setVaultStats] = useState<{ total_notes?: number; total_words?: number } | null>(null)

  useEffect(() => {
    api.knowledge().then((d: any) => setTopics(d.topics || [])).catch(() => {})
    api.vaultStats().then((d: any) => setVaultStats(d)).catch(() => {})
  }, [])

  const filtered = search
    ? topics.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.summary?.toLowerCase().includes(search.toLowerCase()))
    : topics

  const totalWords = topics.reduce((sum, t) => sum + t.word_count, 0)

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2 mb-5 pb-2"
        style={{ borderBottom: '1px solid rgba(201,162,39,0.15)' }}
      >
        <div className="w-[3px] h-3.5 rounded-sm" style={{ background: 'var(--gold)' }} />
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>Knowledge Base</h1>
        <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--gold)', color: '#000', fontWeight: 700 }}>
          {topics.length}
        </span>
      </motion.div>

      {/* Stats + Search row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="p-4 text-center"
          style={glass}
        >
          <BookOpen size={16} className="mx-auto mb-2" style={{ color: 'var(--cyan)' }} />
          <div className="font-mono text-2xl font-bold" style={{ color: 'var(--cyan)' }}>{topics.length}</div>
          <div className="text-[9px] tracking-[1px] uppercase mt-0.5" style={{ color: 'var(--text-d)' }}>Topics</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="p-4 text-center"
          style={glass}
        >
          <div className="font-mono text-2xl font-bold" style={{ color: 'var(--gold-b)' }}>
            {totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}K` : totalWords}
          </div>
          <div className="text-[9px] tracking-[1px] uppercase mt-0.5" style={{ color: 'var(--text-d)' }}>Words</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="p-4 text-center"
          style={glass}
        >
          <div className="font-mono text-2xl font-bold" style={{ color: 'var(--green-t)' }}>
            {vaultStats?.total_notes ?? '--'}
          </div>
          <div className="text-[9px] tracking-[1px] uppercase mt-0.5" style={{ color: 'var(--text-d)' }}>Vault Notes</div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.21 }}
          className="flex items-center gap-2 px-4"
          style={glass}
        >
          <Search size={14} style={{ color: 'var(--text-d)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search topics..."
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text-b)' }}
          />
        </motion.div>
      </div>

      {/* Topic list */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="p-12 text-center"
          style={glass}
        >
          <AgentFace name="default" size={64} active={false} />
          <div className="text-sm mt-4 mb-1" style={{ color: 'var(--text-d)' }}>
            {search ? 'No matching topics' : 'No knowledge topics yet'}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-d)' }}>
            {search ? 'Try a different search term' : 'Knowledge will be built from your vault'}
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((topic, i) => (
            <motion.div
              key={topic.filename}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.28 + i * 0.04 }}
              whileHover={{ scale: 1.01 }}
              className="cursor-pointer overflow-hidden"
              style={glass}
              onClick={() => setExpanded(expanded === topic.filename ? null : topic.filename)}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <AgentFace name="knowledge" size={32} active />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{topic.title}</div>
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-d)' }}>
                  {topic.word_count.toLocaleString()} words
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-d)' }}>
                  {topic.updated}
                </span>
                <motion.div
                  animate={{ rotate: expanded === topic.filename ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={14} style={{ color: 'var(--text-d)' }} />
                </motion.div>
              </div>

              <AnimatePresence>
                {expanded === topic.filename && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-d)', borderTop: '1px solid rgba(201,162,39,0.08)' }}>
                      {topic.summary || 'No summary available.'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
