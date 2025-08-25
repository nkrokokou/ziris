"""
Initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2025-08-25 16:00:00
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False, server_default='user'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_username', 'users', ['username'])

    op.create_table(
        'sensor_data',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('zone', sa.String(), nullable=False),
        sa.Column('temperature', sa.Float(), nullable=False),
        sa.Column('pression', sa.Float(), nullable=False),
        sa.Column('vibration', sa.Float(), nullable=False),
        sa.Column('fumee', sa.Float(), nullable=False),
        sa.Column('flamme', sa.Boolean(), nullable=False),
        sa.Column('anomaly', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
    )
    op.create_index('ix_sensor_data_id', 'sensor_data', ['id'])
    op.create_index('ix_sensor_data_zone', 'sensor_data', ['zone'])

    op.create_table(
        'thresholds',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('temp', sa.Float(), nullable=False, server_default='80.0'),
        sa.Column('press', sa.Float(), nullable=False, server_default='8.0'),
        sa.Column('vib', sa.Float(), nullable=False, server_default='15.0'),
        sa.Column('fumee', sa.Float(), nullable=False, server_default='200.0'),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
    )
    op.create_index('ix_thresholds_id', 'thresholds', ['id'])

    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ts', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
    )
    op.create_index('ix_audit_logs_id', 'audit_logs', ['id'])
    op.create_index('ix_audit_logs_ts', 'audit_logs', ['ts'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])

    op.create_table(
        'thresholds_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('temp', sa.Float(), nullable=False),
        sa.Column('press', sa.Float(), nullable=False),
        sa.Column('vib', sa.Float(), nullable=False),
        sa.Column('fumee', sa.Float(), nullable=False),
        sa.Column('changed_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
    )
    op.create_index('ix_thresholds_history_id', 'thresholds_history', ['id'])

    op.create_table(
        'suggestions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_snapshot', sa.String(), nullable=False, server_default='user'),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('zone', sa.String(), nullable=True),
        sa.Column('sensor_type', sa.String(), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('impact', sa.String(), nullable=False, server_default='Moyen'),
        sa.Column('attachments', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='nouveau'),
        sa.Column('tags', sa.String(), nullable=True),
        sa.Column('assignee_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
    )
    op.create_index('ix_suggestions_id', 'suggestions', ['id'])
    op.create_index('ix_suggestions_category', 'suggestions', ['category'])


def downgrade() -> None:
    op.drop_index('ix_suggestions_category', table_name='suggestions')
    op.drop_index('ix_suggestions_id', table_name='suggestions')
    op.drop_table('suggestions')

    op.drop_index('ix_thresholds_history_id', table_name='thresholds_history')
    op.drop_table('thresholds_history')

    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_ts', table_name='audit_logs')
    op.drop_index('ix_audit_logs_id', table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_index('ix_thresholds_id', table_name='thresholds')
    op.drop_table('thresholds')

    op.drop_index('ix_sensor_data_zone', table_name='sensor_data')
    op.drop_index('ix_sensor_data_id', table_name='sensor_data')
    op.drop_table('sensor_data')

    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_table('users')
