# -*- coding: utf-8 -*-
from setuptools import setup, find_packages


setup(
    name='nulltrace',
    version="1.61",
    packages=find_packages(),
    author="megadose",
    author_email="megadose@protonmail.com",
    install_requires=["termcolor","bs4","httpx","trio","tqdm","colorama","requests"],
    description="NullTrace engine (based on the holehe technique): check which sites an email address is registered on, via public signup/login availability endpoints.",
    include_package_data=True,
    entry_points = {'console_scripts': ['nulltrace = nulltrace.core:main']},
    classifiers=[
        "Programming Language :: Python",
        "License :: OSI Approved :: GNU General Public License v3 (GPLv3)",
    ],
)
