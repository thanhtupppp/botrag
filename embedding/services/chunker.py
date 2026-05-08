"""
Text chunker — sentence-aware, token-counted sliding window.
Dùng tiktoken (cl100k_base) để đếm tokens chính xác.
"""
import re
from typing import List
from dataclasses import dataclass

try:
    import tiktoken
    _enc = tiktoken.get_encoding("cl100k_base")
    def _count_tokens(text: str) -> int:
        return len(_enc.encode(text))
except Exception:
    def _count_tokens(text: str) -> int:
        return len(text) // 4


@dataclass
class Chunk:
    content: str
    index: int
    token_count: int
    char_start: int
    char_end: int


def split_by_sentences(text: str) -> List[str]:
    sentences = re.split(r'(?<=[.!?\n])\s+', text.strip())
    return [s.strip() for s in sentences if s.strip()]


def chunk_text(text: str, chunk_size: int = 512, chunk_overlap: int = 64) -> List[Chunk]:
    if not text or not text.strip():
        return []

    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    sentences: List[tuple] = []
    char_offset = 0
    for para in paragraphs:
        for sent in split_by_sentences(para):
            idx = text.find(sent, char_offset)
            sentences.append((sent, idx if idx != -1 else char_offset))
            char_offset = max(char_offset, (idx if idx != -1 else char_offset) + len(sent))

    chunks: List[Chunk] = []
    current_tokens: List[str] = []
    current_token_count = 0
    current_char_start = 0
    chunk_index = 0

    for sent, sent_char_start in sentences:
        sent_tokens = _count_tokens(sent)

        if sent_tokens > chunk_size:
            words = sent.split()
            temp: List[str] = []
            temp_count = 0
            for word in words:
                wc = _count_tokens(word + " ")
                if temp_count + wc > chunk_size and temp:
                    content = " ".join(temp)
                    chunks.append(Chunk(content, chunk_index, temp_count, sent_char_start, sent_char_start + len(content)))
                    chunk_index += 1
                    temp = []
                    temp_count = 0
                temp.append(word)
                temp_count += wc
            if temp:
                content = " ".join(temp)
                chunks.append(Chunk(content, chunk_index, temp_count, sent_char_start, sent_char_start + len(content)))
                chunk_index += 1
            continue

        if current_token_count + sent_tokens > chunk_size and current_tokens:
            content = " ".join(current_tokens)
            chunks.append(Chunk(content, chunk_index, current_token_count, current_char_start, current_char_start + len(content)))
            chunk_index += 1

            overlap_tokens: List[str] = []
            overlap_count = 0
            for s in reversed(current_tokens):
                sc = _count_tokens(s)
                if overlap_count + sc > chunk_overlap:
                    break
                overlap_tokens.insert(0, s)
                overlap_count += sc

            current_tokens = overlap_tokens + [sent]
            current_token_count = overlap_count + sent_tokens
            current_char_start = sent_char_start
        else:
            if not current_tokens:
                current_char_start = sent_char_start
            current_tokens.append(sent)
            current_token_count += sent_tokens

    if current_tokens:
        content = " ".join(current_tokens)
        chunks.append(Chunk(content, chunk_index, current_token_count, current_char_start, current_char_start + len(content)))

    return chunks
