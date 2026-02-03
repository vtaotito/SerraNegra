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
    # No container, copiamos STATE_MACHINE.json para /app/STATE_MACHINE.json
    path = Path(__file__).resolve().parent.parent / "STATE_MACHINE.json"
    if not path.exists():
        # fallback: /app/STATE_MACHINE.json
        path = Path("/app/STATE_MACHINE.json")
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

