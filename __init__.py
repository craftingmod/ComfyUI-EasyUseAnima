# -*- coding: utf-8 -*-
from .nodes import (
    EasyUseAnimaAnimaDexDatasetDownload,
    EasyUseAnimaNAIARandomPrompt,
    EasyUseAnimaPromptCorrector,
)
from . import api  # noqa: F401 - registers ComfyUI HTTP routes

NODE_CLASS_MAPPINGS = {
    "EasyUseAnimaAnimaDexDatasetDownload": EasyUseAnimaAnimaDexDatasetDownload,
    "EasyUseAnimaNAIARandomPrompt": EasyUseAnimaNAIARandomPrompt,
    "EasyUseAnimaPromptCorrector": EasyUseAnimaPromptCorrector,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EasyUseAnimaAnimaDexDatasetDownload": "AnimaDex Dataset Download",
    "EasyUseAnimaNAIARandomPrompt": "Anima NAIA Random Prompt",
    "EasyUseAnimaPromptCorrector": "Anima Prompt Corrector",
}

WEB_DIRECTORY = "./web"

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]
