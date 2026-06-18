"""Structured background task runner.

asyncio.create_task o'rniga — xatolar log'lanadi, retry mavjud.
"""

import asyncio
import logging
from typing import Callable, Coroutine, Any

log = logging.getLogger("tasks")

_active_tasks: dict[str, asyncio.Task] = {}


def create_background_task(
    coro: Coroutine,
    name: str,
    on_error: str = "log",  # "log" | "restart"
) -> asyncio.Task:
    """Background task yaratadi va xatolarni kuzatadi.

    Args:
        coro: async coroutine
        name: task nomi (monitoring uchun)
        on_error: "log" — faqat log, "restart" — qayta ishga tushirish
    """
    async def _wrapper():
        try:
            await coro
        except asyncio.CancelledError:
            log.info("Task '%s' cancelled", name)
            raise
        except Exception as exc:
            log.error("Task '%s' failed: %s", name, exc, exc_info=True)
            if on_error == "restart":
                log.info("Restarting task '%s' in 5s...", name)
                await asyncio.sleep(5)
                # Recursive restart
                create_background_task(coro, name, on_error)

    task = asyncio.create_task(_wrapper(), name=name)
    _active_tasks[name] = task
    return task


def get_active_tasks() -> dict[str, str]:
    """Aktiv tasklarni statuslari bilan qaytaradi."""
    result = {}
    for name, task in _active_tasks.items():
        if task.done():
            if task.cancelled():
                result[name] = "cancelled"
            elif task.exception():
                result[name] = f"failed: {task.exception()}"
            else:
                result[name] = "completed"
        else:
            result[name] = "running"
    return result
