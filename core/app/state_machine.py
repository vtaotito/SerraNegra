import os
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple


@dataclass(frozen=True)
class Transition:
    from_state: str
    event_type: str
    to_state: str


class OrderStateMachine:
    def __init__(self, transitions: list[Transition], initial_state: str, final_states: list[str]):
        self.initial_state = initial_state
        self.final_states = set(final_states)
        self._next: Dict[Tuple[str, str], str] = {}
        for t in transitions:
            self._next[(t.from_state, t.event_type)] = t.to_state

    def is_final(self, state: str) -> bool:
        return state in self.final_states

    def next_state(self, state: str, event_type: str) -> str | None:
        return self._next.get((state, event_type))


def load_state_machine() -> OrderStateMachine:
    """
    Carrega o state machine de pedidos.

    Ordem de busca:
    - `STATE_MACHINE_PATH` (se definido)
    - Raiz do repositório (../../..): `STATE_MACHINE.json`
    - Container path: `/app/STATE_MACHINE.json`
    """
    candidates: list[Path] = []
    env_path = os.getenv("STATE_MACHINE_PATH")
    if env_path:
        candidates.append(Path(env_path))

    # repo root (core/app/ -> core/ -> repo/)
    candidates.append(Path(__file__).resolve().parents[2] / "STATE_MACHINE.json")

    # container fallback
    candidates.append(Path("/app/STATE_MACHINE.json"))

    path = next((p for p in candidates if p.exists()), None)
    if not path:
        raise FileNotFoundError(
            "STATE_MACHINE.json não encontrado. Defina STATE_MACHINE_PATH ou garanta o arquivo na raiz do projeto."
        )

    data = json.loads(path.read_text(encoding="utf-8"))
    transitions = [
        Transition(from_state=t["from"], event_type=t["eventType"], to_state=t["to"])
        for t in data.get("transitions", [])
    ]
    return OrderStateMachine(
        transitions=transitions,
        initial_state=data["initialState"],
        final_states=data.get("finalStates", []),
    )


order_sm = load_state_machine()

